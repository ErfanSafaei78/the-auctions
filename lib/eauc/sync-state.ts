import "server-only";

export interface SyncState {
  /** ISO-8601 UTC of the last successful fetch — cron or manual, either counts. */
  fetchedAt: string | null;
  fetchedAtJalali: string | null;
  records: number;
  running: boolean;
  /** ISO-8601 UTC of when the current run claimed the lock. */
  startedAt: string | null;
  lastError: string | null;
}

const EMPTY_STATE: SyncState = {
  fetchedAt: null,
  fetchedAtJalali: null,
  records: 0,
  running: false,
  startedAt: null,
  lastError: null,
};

/**
 * Deliberately separate from the ~620 KB snapshot blob. This one is polled
 * every couple of seconds while a sync is watched, so it stays a few hundred
 * bytes and is never routed through the hourly-revalidated Data Cache used
 * for the snapshot — every read here must be live.
 */
export const SYNC_STATE_PATHNAME = "auctions/sync-state.json";

const LOCAL_STATE_PATH = ".cache/auctions-sync-state.json";

function hasBlobCredentials() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readLocalState(): Promise<SyncState> {
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(LOCAL_STATE_PATH, "utf8");
    return { ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<SyncState>) };
  } catch {
    return EMPTY_STATE;
  }
}

async function writeLocalState(state: SyncState) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");

  await mkdir(dirname(LOCAL_STATE_PATH), { recursive: true });
  await writeFile(LOCAL_STATE_PATH, JSON.stringify(state), "utf8");
}

export async function readSyncState(): Promise<SyncState> {
  if (!hasBlobCredentials()) return readLocalState();

  const { head } = await import("@vercel/blob");

  try {
    const meta = await head(SYNC_STATE_PATHNAME);
    // head() asks the Blob API, so uploadedAt is current even when the CDN
    // copy isn't. Keying the URL on it makes every write a fresh cache entry;
    // a bare meta.url can serve the pre-sync state for up to a minute, which
    // the poller would read as "not running, fetchedAt unchanged": a failure.
    const response = await fetch(
      `${meta.url}?v=${meta.uploadedAt.getTime()}`,
      { cache: "no-store" },
    );
    if (!response.ok) return EMPTY_STATE;

    const parsed = (await response.json()) as Partial<SyncState>;
    return { ...EMPTY_STATE, ...parsed };
  } catch {
    return EMPTY_STATE;
  }
}

async function writeSyncState(state: SyncState) {
  if (!hasBlobCredentials()) return writeLocalState(state);

  const { put } = await import("@vercel/blob");

  await put(SYNC_STATE_PATHNAME, JSON.stringify(state), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    // Blob's floor. Anything lower is silently raised to 60s, which is why
    // readSyncState versions the URL instead of relying on this.
    cacheControlMaxAge: 60,
  });
}

/** Read-modify-write. Best-effort under concurrent writers — see lib/eauc/actions.ts. */
export async function patchSyncState(
  patch: Partial<SyncState>,
): Promise<SyncState> {
  const current = await readSyncState();
  const next = { ...current, ...patch };
  await writeSyncState(next);
  return next;
}

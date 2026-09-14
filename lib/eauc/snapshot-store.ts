import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import type { AuctionRecord, AuctionSnapshot } from "./types";

export const SNAPSHOT_PATHNAME = "auctions/estate-snapshot.json";
export const SNAPSHOT_TAG = "auctions-snapshot";

const LOCAL_SNAPSHOT_PATH = ".cache/auctions-snapshot.json";

function hasBlobCredentials() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function writeLocalSnapshot(snapshot: AuctionSnapshot) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");

  await mkdir(dirname(LOCAL_SNAPSHOT_PATH), { recursive: true });
  await writeFile(LOCAL_SNAPSHOT_PATH, JSON.stringify(snapshot), "utf8");
}

async function readLocalSnapshot(): Promise<AuctionSnapshot | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(LOCAL_SNAPSHOT_PATH, "utf8");
    return JSON.parse(raw) as AuctionSnapshot;
  } catch {
    return null;
  }
}

export async function writeSnapshot(snapshot: AuctionSnapshot) {
  if (!hasBlobCredentials()) {
    await writeLocalSnapshot(snapshot);
    return;
  }

  const { put } = await import("@vercel/blob");

  await put(SNAPSHOT_PATHNAME, JSON.stringify(snapshot), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    // Blob's CDN default is a month and this path is overwritten daily.
    cacheControlMaxAge: 60,
  });
}

async function loadSnapshot(): Promise<AuctionSnapshot | null> {
  if (!hasBlobCredentials()) return readLocalSnapshot();

  const { head } = await import("@vercel/blob");

  try {
    const meta = await head(SNAPSHOT_PATHNAME);
    // Versioned by uploadedAt (from the Blob API, not the CDN). This runs
    // right after a sync's revalidateTag; a bare meta.url can still return
    // the previous snapshot for up to 60s, which would then be cached here
    // for the full hour.
    const response = await fetch(
      `${meta.url}?v=${meta.uploadedAt.getTime()}`,
      { cache: "no-store" },
    );
    if (!response.ok) return null;

    return (await response.json()) as AuctionSnapshot;
  } catch {
    return null;
  }
}

/**
 * One blob read per hour per region instead of one per pageview. The cron
 * revalidates this tag after a successful write, so a fresh snapshot is
 * visible immediately rather than up to an hour later.
 */
const loadSnapshotCached = unstable_cache(loadSnapshot, ["auctions-snapshot"], {
  revalidate: 3600,
  tags: [SNAPSHOT_TAG],
});

/**
 * React cache() dedupes within one request — detail pages read the snapshot
 * in both generateMetadata and the page — and is a pass-through elsewhere.
 */
export const readSnapshot = cache(
  async (): Promise<AuctionSnapshot | null> => {
    // The dev filesystem fallback must not be cached across requests, or a
    // local re-sync would appear to do nothing until the process restarts.
    if (!hasBlobCredentials()) return readLocalSnapshot();

    return loadSnapshotCached();
  },
);

export function findRecordByPartyId(
  snapshot: AuctionSnapshot | null,
  partyId: string,
): AuctionRecord | null {
  if (!snapshot) return null;
  return snapshot.records.find((record) => record.partyId === partyId) ?? null;
}

export function findRecordsByAuctionId(
  snapshot: AuctionSnapshot | null,
  auctionId: string,
): AuctionRecord[] {
  if (!snapshot) return [];
  return snapshot.records.filter((record) => record.auctionId === auctionId);
}

"use server";

import { after } from "next/server";

import { isDirectFetchEnabled } from "./direct-fetch";
import { runAuctionSync } from "./sync";
import { patchSyncState, readSyncState } from "./sync-state";

/**
 * Sliding, not clock-aligned: measured from the last successful fetch
 * (cron or manual), so a late cron run doesn't shrink the window below 4h.
 * Exists to keep our request volume against setadiran low and unremarkable,
 * not for our own cost — a sync is ~600 KB and costs us nothing.
 */
const RATE_LIMIT_MS = 4 * 60 * 60 * 1000;

/** A run older than this is treated as crashed, not in-progress, and unlocked. */
const STALE_RUNNING_MS = 5 * 60 * 1000;

export type SyncActionResult =
  | { status: "started" }
  | { status: "already-running"; startedAt: string }
  | { status: "too-soon"; nextAllowedAt: string; fetchedAt: string }
  | { status: "unavailable" };

/**
 * Same-instance dedupe for a warm lambda. Best-effort only — the real,
 * cross-instance guard is the `running` flag in sync-state.json below. A
 * double-run is harmless anyway: runAuctionSync is idempotent, it just
 * overwrites the same snapshot, so this only saves upstream requests.
 */
let inFlight: Promise<void> | null = null;

export async function syncAuctionsAction(): Promise<SyncActionResult> {
  // A server action is a public endpoint whatever the UI renders, so the
  // guard lives here too, not only in whether the button is clickable.
  if (!isDirectFetchEnabled()) return { status: "unavailable" };

  const state = await readSyncState();
  const now = Date.now();

  if (state.running && state.startedAt) {
    const runningFor = now - Date.parse(state.startedAt);
    if (runningFor >= 0 && runningFor < STALE_RUNNING_MS) {
      return { status: "already-running", startedAt: state.startedAt };
    }
  }

  if (state.fetchedAt) {
    const sinceLastFetch = now - Date.parse(state.fetchedAt);
    if (sinceLastFetch >= 0 && sinceLastFetch < RATE_LIMIT_MS) {
      const nextAllowedAt = new Date(
        Date.parse(state.fetchedAt) + RATE_LIMIT_MS,
      ).toISOString();
      return { status: "too-soon", nextAllowedAt, fetchedAt: state.fetchedAt };
    }
  }

  if (inFlight) {
    return {
      status: "already-running",
      startedAt: state.startedAt ?? new Date(now).toISOString(),
    };
  }

  const startedAt = new Date(now).toISOString();
  await patchSyncState({ running: true, startedAt, lastError: null });

  // runAuctionSync records its own failures in sync state. The rejection
  // handler only fires if that bookkeeping write itself threw, and logs it
  // instead of letting it surface as an unhandled rejection.
  const run = runAuctionSync().then(
    () => undefined,
    (error: unknown) => {
      console.error("Auction sync crashed", error);
    },
  );
  inFlight = run.finally(() => {
    inFlight = null;
  });

  // Returns to the client immediately; the fetch+validate+write continues
  // after this response is sent, bounded by maxDuration on the page that
  // invoked the action (see app/page.tsx).
  after(() => run);

  return { status: "started" };
}

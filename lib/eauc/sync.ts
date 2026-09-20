import "server-only";

import { revalidateTag } from "next/cache";

import { fetchAuctionList, type RawListResponse } from "./list";
import { buildSnapshot } from "./normalize";
import { readSnapshot, SNAPSHOT_TAG, writeSnapshot } from "./snapshot-store";
import { patchSyncState } from "./sync-state";
import type { AuctionSnapshot } from "./types";
import { notifyNewAuctions } from "@/lib/telegram/notify";

/** Normalization dropping more than 5% of rows means the shape changed. */
const MIN_NORMALIZED_RATIO = 0.95;
/** A response shorter than half of yesterday is a truncation, not a real drop. */
const MIN_PREVIOUS_RATIO = 0.5;
/** Province backs a primary filter; losing it signals upstream field drift. */
const MIN_PROVINCE_COVERAGE = 0.5;

function validateSnapshot(
  next: AuctionSnapshot,
  previous: AuctionSnapshot | null,
): string | null {
  if (!Number.isFinite(next.upstreamRecords) || next.upstreamRecords < 1) {
    return "upstream reported no records";
  }

  if (next.records.length < next.upstreamRecords * MIN_NORMALIZED_RATIO) {
    return `normalized ${next.records.length} of ${next.upstreamRecords} rows`;
  }

  if (
    previous &&
    next.records.length < previous.records.length * MIN_PREVIOUS_RATIO
  ) {
    return `record count collapsed from ${previous.records.length} to ${next.records.length}`;
  }

  const withProvince = next.records.filter((r) => r.lotProvince).length;
  if (withProvince < next.records.length * MIN_PROVINCE_COVERAGE) {
    return `lotProvince populated on only ${withProvince} of ${next.records.length} rows`;
  }

  return null;
}

/**
 * A skewed multi-request page-through risks corrupting the frozen row order
 * (a lot shifting position mid-fetch means a duplicate or a miss), and a burst
 * of requests is a more visible pattern to setadiran than a single one. So
 * resilience comes from retrying the whole ~4s call, not from chunking it.
 */
const RETRY_DELAYS_MS = [2000, 6000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchListWithRetry(): Promise<RawListResponse> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await fetchAuctionList();
    } catch (error) {
      lastError = error;
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined) await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export interface SyncOutcome {
  ok: boolean;
  records?: number;
  upstreamRecords?: number;
  fetchedAt?: string;
  fetchedAtJalali?: string;
  reason?: "validation_failed" | "upstream_error" | "invalid_payload";
  detail?: string;
}

/**
 * The single writer. Every path that can change the snapshot ends here — our
 * own fetch, and rows pushed to /api/ingest by a runner with Iranian egress —
 * so the validation gates and state bookkeeping cannot be bypassed by
 * whoever supplied the rows.
 */
export async function commitSnapshot(
  raw: RawListResponse,
): Promise<SyncOutcome> {
  try {
    const previous = await readSnapshot();
    const next = buildSnapshot(raw, new Date(), previous);

    const failure = validateSnapshot(next, previous);
    if (failure) {
      // Refusing to write is the whole guarantee: a bad run leaves the last
      // good snapshot in place rather than half-replacing it.
      await patchSyncState({ running: false, startedAt: null, lastError: failure });

      return {
        ok: false,
        reason: "validation_failed",
        detail: failure,
        upstreamRecords: next.upstreamRecords,
        records: next.records.length,
      };
    }

    await writeSnapshot(next);
    revalidateTag(SNAPSHOT_TAG);

    // Best-effort: a failed Telegram send must never undo or fail a snapshot
    // write that already succeeded.
    await notifyNewAuctions(previous, next).catch((error) => {
      console.error("Telegram notify crashed", error);
    });

    await patchSyncState({
      fetchedAt: next.fetchedAt,
      fetchedAtJalali: next.fetchedAtJalali,
      records: next.records.length,
      running: false,
      startedAt: null,
      lastError: null,
    });

    return {
      ok: true,
      records: next.records.length,
      upstreamRecords: next.upstreamRecords,
      fetchedAt: next.fetchedAt,
      fetchedAtJalali: next.fetchedAtJalali,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await patchSyncState({ running: false, startedAt: null, lastError: detail });

    return { ok: false, reason: "upstream_error", detail };
  }
}

/**
 * Fetch-then-commit, for the cron route and the manual sync action. Only
 * usable from a network that setadiran answers — see /api/ingest for the
 * path that does not fetch.
 */
export async function runAuctionSync(): Promise<SyncOutcome> {
  let raw: RawListResponse;

  try {
    raw = await fetchListWithRetry();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await patchSyncState({ running: false, startedAt: null, lastError: detail });

    return { ok: false, reason: "upstream_error", detail };
  }

  return commitSnapshot(raw);
}

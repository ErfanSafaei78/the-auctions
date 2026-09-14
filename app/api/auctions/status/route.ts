import { readSyncState } from "@/lib/eauc/sync-state";

/**
 * Polled every ~2s while a sync is being watched. Intentionally unauthenticated
 * and unlimited: it only reads a few hundred bytes of non-sensitive data (the
 * same numbers already shown on the board) and triggers no upstream call.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const state = await readSyncState();

  return Response.json(
    {
      fetchedAt: state.fetchedAt,
      records: state.records,
      running: state.running,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

import { runAuctionSync } from "@/lib/eauc/sync";
import { secretMatches } from "@/lib/secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * runAuctionSync makes up to 3 attempts, each capped by the 30s list request
 * timeout, with 8s of backoff in total: ~100s worst case including a session
 * bootstrap, still under this ceiling.
 */
export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ ok: false, reason: "not_configured" }, { status: 500 });
  }

  if (!secretMatches(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return new Response(null, { status: 401 });
  }

  const outcome = await runAuctionSync();
  return Response.json(outcome, { status: outcome.ok ? 200 : 500 });
}

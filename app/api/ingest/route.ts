import { coerceListPayload } from "@/lib/eauc/list";
import { commitSnapshot } from "@/lib/eauc/sync";
import { secretMatches } from "@/lib/secret";

/**
 * Accepts the upstream list payload from a runner that can reach setadiran —
 * Vercel's egress cannot, because eauc.setadiran.ir answers Iranian IPs only.
 * The body is exactly what `mainEstate-Load.action` returns, unmodified.
 *
 * Normalization and the validation gates stay here rather than in the runner,
 * so a bad or hostile payload still has to survive the same checks a direct
 * fetch would, and snapshotRow/snapshotPage are frozen by us.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ ok: false, reason: "not_configured" }, { status: 500 });
  }

  if (!secretMatches(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return new Response(null, { status: 401 });
  }

  let raw;
  try {
    raw = coerceListPayload(await request.json());
  } catch (error) {
    return Response.json(
      {
        ok: false,
        reason: "invalid_payload",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }

  const outcome = await commitSnapshot(raw);
  return Response.json(outcome, { status: outcome.ok ? 200 : 500 });
}

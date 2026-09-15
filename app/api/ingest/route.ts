import { gunzipSync } from "node:zlib";

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

/**
 * Vercel rejects a request body over 4.5 MB before it reaches this route, and
 * the raw list payload is past that, so a push has to arrive gzipped.
 */
const MAX_DECOMPRESSED_BYTES = 64 * 1024 * 1024;

/**
 * Sniffs the gzip magic number rather than trusting Content-Encoding: iOS
 * Shortcuts cannot always set that header, and a mislabelled body would
 * otherwise fail as a JSON parse error that says nothing useful.
 */
function decodeBody(body: Buffer): string {
  if (body.length > 1 && body[0] === 0x1f && body[1] === 0x8b) {
    return gunzipSync(body, {
      maxOutputLength: MAX_DECOMPRESSED_BYTES,
    }).toString("utf8");
  }

  return body.toString("utf8");
}

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
    const body = Buffer.from(await request.arrayBuffer());
    raw = coerceListPayload(JSON.parse(decodeBody(body)));
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

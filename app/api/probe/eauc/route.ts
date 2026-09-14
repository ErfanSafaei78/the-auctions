import { fetchAuctionDetail, fetchLotDetail } from "@/lib/eauc/detail";
import { fetchAuctionList } from "@/lib/eauc/list";
import { buildSnapshot } from "@/lib/eauc/normalize";
import { bootstrapEaucSession } from "@/lib/eauc/session";
import { secretMatches } from "@/lib/secret";

/**
 * TEMPORARY diagnostic route.
 *
 * Every eauc endpoint was verified from a machine in Iran. This answers the
 * one open question: can Vercel's egress reach setadiran at all? Delete once
 * that is settled.
 *
 * Auth: Bearer CRON_SECRET, or ?key=<CRON_SECRET> so it can be opened in a
 * browser.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface StepResult {
  step: string;
  ok: boolean;
  ms: number;
  detail: string;
}

async function timed(
  step: string,
  run: () => Promise<string>,
): Promise<StepResult> {
  const startedAt = Date.now();

  try {
    const detail = await run();
    return { step, ok: true, ms: Date.now() - startedAt, detail };
  } catch (error) {
    return {
      step,
      ok: false,
      ms: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const authorized =
    secretMatches(request.headers.get("authorization"), `Bearer ${secret}`) ||
    secretMatches(url.searchParams.get("key"), secret);

  if (!authorized) return new Response(null, { status: 401 });

  const steps: StepResult[] = [];
  let sampleAuctionId: string | null = null;
  let samplePartyId: string | null = null;

  steps.push(
    await timed("bootstrapSession", async () => {
      const jar = await bootstrapEaucSession();
      return `${jar.size} cookies`;
    }),
  );

  steps.push(
    await timed("fetchList", async () => {
      const raw = await fetchAuctionList();
      const snapshot = buildSnapshot(raw, new Date());
      const first = snapshot.records[0];
      sampleAuctionId = first?.auctionId ?? null;
      samplePartyId = first?.partyId ?? null;

      return [
        `upstream=${raw.records}`,
        `normalized=${snapshot.records.length}`,
        `groups=${snapshot.facets.goodsGroups.length}`,
        `provinces=${snapshot.facets.lotProvinces.length}`,
      ].join(" ");
    }),
  );

  if (sampleAuctionId) {
    steps.push(
      await timed("fetchAuctionDetail", async () => {
        const detail = await fetchAuctionDetail(sampleAuctionId!);
        return `${detail.fields.length} fields`;
      }),
    );
  }

  if (samplePartyId) {
    steps.push(
      await timed("fetchLotDetail", async () => {
        const detail = await fetchLotDetail(samplePartyId!);
        return `${detail.fields.length} fields, ${detail.items?.length ?? "unavailable"} items, deposit=${detail.depositAmount ?? "none"}`;
      }),
    );
  }

  const reachable = steps.every((step) => step.ok);

  return Response.json(
    {
      reachable,
      region: process.env.VERCEL_REGION ?? "local",
      totalMs: steps.reduce((sum, step) => sum + step.ms, 0),
      steps,
    },
    { status: reachable ? 200 : 502 },
  );
}

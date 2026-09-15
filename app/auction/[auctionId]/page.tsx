import type { Metadata } from "next";
import Link from "next/link";

import { DetailError } from "@/components/detail/DetailError";
import { DetailHeader } from "@/components/detail/DetailHeader";
import { NotFoundPanel } from "@/components/detail/NotFoundPanel";
import { ScrapedFields } from "@/components/detail/ScrapedFields";
import { EAUC_WELCOME_URL } from "@/lib/eauc/constants";
import { fetchAuctionDetail } from "@/lib/eauc/detail";
import { isDirectFetchEnabled } from "@/lib/eauc/direct-fetch";
import { findRecordsByAuctionId, readSnapshot } from "@/lib/eauc/snapshot-store";
import { auctionFields } from "@/lib/eauc/snapshot-fields";
import type { AuctionDetail } from "@/lib/eauc/types";
import { toPersianDigits } from "@/lib/format/digits";

export const dynamic = "force-dynamic";

interface AuctionDetailPageProps {
  params: Promise<{ auctionId: string }>;
}

/** Metadata reads the snapshot, never upstream — that would double every POST. */
export async function generateMetadata({
  params,
}: AuctionDetailPageProps): Promise<Metadata> {
  const { auctionId } = await params;
  const [record] = findRecordsByAuctionId(await readSnapshot(), auctionId);

  return {
    title: record?.auctionNo
      ? `مزایده ${toPersianDigits(record.auctionNo)}`
      : "جزییات مزایده",
  };
}

export default async function AuctionDetailPage({
  params,
}: AuctionDetailPageProps) {
  const { auctionId } = await params;
  if (!/^\d+$/.test(auctionId)) return <NotFoundPanel />;

  const lots = findRecordsByAuctionId(await readSnapshot(), auctionId);
  const [record] = lots;

  // Upstream's field list is richer than the row, so it wins where reachable.
  // A failure falls back to the row rather than to an error panel.
  let detail: AuctionDetail | null = null;
  if (isDirectFetchEnabled()) {
    try {
      detail = await fetchAuctionDetail(auctionId);
    } catch {
      detail = null;
    }
  }

  if (!record && !detail) {
    return isDirectFetchEnabled() ? (
      <DetailError title={`مزایده ${toPersianDigits(auctionId)}`} />
    ) : (
      <NotFoundPanel />
    );
  }

  const title = `مزایده ${toPersianDigits(record?.auctionNo ?? auctionId)}`;

  return (
    <section className="mx-auto w-full max-w-[72rem] animate-fade-in px-4 py-10 sm:px-6">
      <DetailHeader title={title}>
        <a
          href={EAUC_WELCOME_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-block text-sm text-accent underline-offset-4 hover:underline"
        >
          مشاهده در ستاد ایران
        </a>
      </DetailHeader>

      <div className="rounded-xl border border-line bg-surface p-6 shadow-panel">
        <h2 className="mb-4 text-lg font-semibold">مشخصات</h2>
        <ScrapedFields
          fields={detail?.fields ?? (record ? auctionFields(record) : [])}
        />
      </div>

      {/* Setadiran never shows an auction's sibling lots. The snapshot already
          knows them, so the cross-link costs nothing. */}
      {lots.length > 0 ? (
        <div className="mt-4 rounded-xl border border-line bg-surface p-6 shadow-panel">
          <h2 className="mb-4 text-lg font-semibold">پارتی‌های این مزایده</h2>

          <ul className="flex flex-col gap-1">
            {lots.map((lot) => (
              <li key={lot.partyId}>
                <Link
                  href={`/party/${lot.partyId}`}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md px-2 py-1.5 transition-colors hover:bg-raised"
                >
                  <span className="text-accent">
                    {toPersianDigits(lot.partyNo)}
                  </span>
                  <span className="text-sm text-muted">{lot.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

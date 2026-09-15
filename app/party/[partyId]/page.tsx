import type { Metadata } from "next";
import Link from "next/link";

import { DetailHeader } from "@/components/detail/DetailHeader";
import { NotFoundPanel } from "@/components/detail/NotFoundPanel";
import { ScrapedFields } from "@/components/detail/ScrapedFields";
import { EAUC_WELCOME_URL } from "@/lib/eauc/constants";
import { findRecordByPartyId, readSnapshot } from "@/lib/eauc/snapshot-store";
import { lotFields } from "@/lib/eauc/snapshot-fields";
import { toPersianDigits } from "@/lib/format/digits";

export const dynamic = "force-dynamic";

interface LotDetailPageProps {
  params: Promise<{ partyId: string }>;
}

export async function generateMetadata({
  params,
}: LotDetailPageProps): Promise<Metadata> {
  const { partyId } = await params;
  const record = findRecordByPartyId(await readSnapshot(), partyId);

  return {
    title: record?.partyNo
      ? `پارتی ${toPersianDigits(record.partyNo)}`
      : "جزییات پارتی",
  };
}

export default async function LotDetailPage({ params }: LotDetailPageProps) {
  const { partyId } = await params;
  if (!/^\d+$/.test(partyId)) return <NotFoundPanel />;

  // The snapshot is the only source now. A lot it has never seen can't be
  // rendered at all, where the old live fetch could still resolve it.
  const record = findRecordByPartyId(await readSnapshot(), partyId);
  if (!record) return <NotFoundPanel />;

  const title = `پارتی ${toPersianDigits(record.partyNo)}`;

  return (
    <section className="mx-auto w-full max-w-[72rem] animate-fade-in px-4 py-10 sm:px-6">
      <DetailHeader title={title}>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link
            href={`/auction/${record.auctionId}`}
            className="text-accent underline-offset-4 hover:underline"
          >
            مزایده {toPersianDigits(record.auctionNo)}
          </Link>
          <a
            href={EAUC_WELCOME_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent underline-offset-4 hover:underline"
          >
            مشاهده در ستاد ایران
          </a>
        </div>
      </DetailHeader>

      <div className="rounded-xl border border-line bg-surface p-6 shadow-panel">
        <h2 className="mb-4 text-lg font-semibold">مشخصات</h2>
        <ScrapedFields fields={lotFields(record)} />
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface p-6 shadow-panel">
        <h2 className="mb-2 text-lg font-semibold">کالاها و ودیعه</h2>
        <p className="text-sm text-muted">
          فهرست کالاها و مبلغ ودیعه تنها در سامانه ستاد ایران در دسترس است.
        </p>
        <a
          href={EAUC_WELCOME_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-block text-sm text-accent underline-offset-4 hover:underline"
        >
          مشاهده در ستاد ایران
        </a>
      </div>
    </section>
  );
}

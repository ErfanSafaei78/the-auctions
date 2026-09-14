import type { Metadata } from "next";
import Link from "next/link";

import { DetailError } from "@/components/detail/DetailError";
import { DetailHeader } from "@/components/detail/DetailHeader";
import { NotFoundPanel } from "@/components/detail/NotFoundPanel";
import { ScrapedFields } from "@/components/detail/ScrapedFields";
import { EAUC_WELCOME_URL } from "@/lib/eauc/constants";
import { fetchLotDetail } from "@/lib/eauc/detail";
import { findRecordByPartyId, readSnapshot } from "@/lib/eauc/snapshot-store";
import { toPersianDigits } from "@/lib/format/digits";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const CELL = "border border-line px-3 py-2 text-start";

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

  // Snapshot lookup is for display and cross-linking only. The upstream
  // endpoint keys solely off partyId, so this page works for a lot the
  // snapshot has never seen.
  const record = findRecordByPartyId(await readSnapshot(), partyId);
  const title = `پارتی ${toPersianDigits(record?.partyNo ?? partyId)}`;

  let detail;
  try {
    detail = await fetchLotDetail(partyId);
  } catch {
    return <DetailError title={title} />;
  }

  return (
    <section className="mx-auto w-full max-w-[72rem] animate-fade-in px-4 py-10 sm:px-6">
      <DetailHeader title={title}>
        <div className="flex flex-wrap gap-4 text-sm">
          {record ? (
            <Link
              href={`/auction/${record.auctionId}`}
              className="text-accent underline-offset-4 hover:underline"
            >
              مزایده {toPersianDigits(record.auctionNo)}
            </Link>
          ) : null}
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
        <ScrapedFields fields={detail.fields} />
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface p-6 shadow-panel">
        <h2 className="mb-4 text-lg font-semibold">کالاها</h2>

        {detail.items === null ? (
          <p className="text-sm text-danger">
            فهرست کالاها از ستاد دریافت نشد. کمی بعد صفحه را تازه کنید.
          </p>
        ) : detail.items.length === 0 ? (
          <p className="text-sm text-muted">کالایی ثبت نشده است.</p>
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-raised">
                <tr>
                  <th scope="col" className={cn(CELL, "font-medium")}>
                    شرح کالا
                  </th>
                  <th scope="col" className={cn(CELL, "font-medium")}>
                    مقدار/تعداد
                  </th>
                  <th scope="col" className={cn(CELL, "font-medium")}>
                    واحد شمارش
                  </th>
                  <th scope="col" className={cn(CELL, "font-medium")}>
                    گروه کالا
                  </th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item, index) => (
                  <tr key={`${item.title}-${index}`}>
                    <td className={CELL}>{item.title || "—"}</td>
                    <td className={CELL}>
                      {item.amount ? toPersianDigits(item.amount) : "—"}
                    </td>
                    <td className={CELL}>{item.unit || "—"}</td>
                    <td className={CELL}>{item.group || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {detail.depositAmount ? (
          <p className="mt-4 text-sm">
            <span className="text-muted">مبلغ ودیعه: </span>
            <span>{toPersianDigits(detail.depositAmount)}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}

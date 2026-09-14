"use client";

import Link from "next/link";

import { toPersianDigits } from "@/lib/format/digits";
import { formatJalaliDateTime } from "@/lib/format/jalali";
import { formatCount, formatRial } from "@/lib/format/number";
import type { AuctionRecord } from "@/lib/eauc/types";

/** Mobile fallback: the 13-column table is unusable below `md`. */
export function AuctionCardList({ records }: { records: AuctionRecord[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {records.map((record) => {
        const price = formatRial(record.reservePrice);
        const deadline = formatJalaliDateTime(record.proposalTo);

        return (
          <li
            key={record.partyId}
            className="rounded-xl border border-line bg-surface p-4 shadow-panel"
          >
            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-subtle">
              <span>
                ردیف {formatCount(record.snapshotRow)} · ص{" "}
                {formatCount(record.snapshotPage)} ستاد
              </span>
              {record.goodsGroup ? (
                <span className="rounded-full border border-line bg-raised px-2 py-0.5">
                  {record.goodsGroup}
                </span>
              ) : null}
            </div>

            <Link
              href={`/party/${record.partyId}`}
              className="block font-medium text-fg underline-offset-4 hover:underline"
            >
              {record.title || toPersianDigits(record.partyNo)}
            </Link>

            <p className="mt-1 text-sm text-muted">{record.auctioneerName}</p>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-subtle">محل پارتی</dt>
                <dd>
                  {record.lotProvince}
                  {record.lotCity ? ` · ${record.lotCity}` : ""}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-subtle">قیمت پایه (ریال)</dt>
                <dd>{price ?? "—"}</dd>
              </div>

              <div className="col-span-2">
                <dt className="text-xs text-subtle">مهلت ارسال پیشنهاد</dt>
                <dd>{deadline ?? "—"}</dd>
              </div>
            </dl>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <Link
                href={`/auction/${record.auctionId}`}
                className="text-accent underline-offset-4 hover:underline"
              >
                مزایده {toPersianDigits(record.auctionNo)}
              </Link>
              <Link
                href={`/party/${record.partyId}`}
                className="text-accent underline-offset-4 hover:underline"
              >
                پارتی {toPersianDigits(record.partyNo)}
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

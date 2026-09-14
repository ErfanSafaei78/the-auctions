"use client";

import Link from "next/link";

import { Tooltip } from "@/components/ui/Tooltip";
import { TruncatedText } from "@/components/ui/TruncatedText";
import { toPersianDigits } from "@/lib/format/digits";
import { formatJalaliDate, formatJalaliDateTime } from "@/lib/format/jalali";
import { formatCount, formatRial } from "@/lib/format/number";
import type { AuctionRecord } from "@/lib/eauc/types";
import { cn } from "@/lib/cn";

const CELL = "border-b border-line px-3 py-2 text-start align-top";
const HEAD = cn(
  CELL,
  "whitespace-nowrap border-b-line-strong bg-raised font-medium",
);

const NONE = <span className="text-subtle">—</span>;

interface AuctionTableProps {
  records: AuctionRecord[];
}

function DateRange({ from, to }: { from: string | null; to: string | null }) {
  const fromText = formatJalaliDateTime(from);
  const toText = formatJalaliDateTime(to);

  if (!fromText && !toText) return NONE;

  return (
    <span className="block whitespace-nowrap leading-relaxed">
      {fromText ? (
        <span className="block">
          <span className="text-subtle">از </span>
          {fromText}
        </span>
      ) : null}
      {toText ? (
        <span className="block">
          <span className="text-subtle">تا </span>
          {toText}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The table grows to its full height and the page scrolls vertically; only
 * the horizontal axis scrolls inside the container, with the row-number
 * column pinned. A viewport-level sticky header cannot survive that
 * `overflow-x` ancestor, so the pager is repeated above the table instead.
 */
export function AuctionTable({ records }: AuctionTableProps) {
  return (
    <div className="scroll-thin overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th
              scope="col"
              className={cn(HEAD, "sticky start-0 z-30 border-e border-line")}
            >
              <Tooltip
                content="ردیف و صفحه در سایت ستاد ایران"
                className="underline decoration-dotted decoration-line-strong underline-offset-4"
              >
                ردیف
              </Tooltip>
            </th>
            <th scope="col" className={HEAD}>شماره مزایده</th>
            <th scope="col" className={HEAD}>دستگاه مزایده‌گزار</th>
            <th scope="col" className={HEAD}>استان دستگاه</th>
            <th scope="col" className={HEAD}>شماره پارتی</th>
            <th scope="col" className={HEAD}>شرح پارتی</th>
            <th scope="col" className={HEAD}>استان پارتی</th>
            <th scope="col" className={HEAD}>گروه کالا</th>
            <th scope="col" className={HEAD}>قیمت پایه (ریال)</th>
            <th scope="col" className={HEAD}>تاریخ انتشار</th>
            <th scope="col" className={HEAD}>مهلت ارسال پیشنهاد</th>
            <th scope="col" className={HEAD}>آخرین اصلاح اطلاعات</th>
            <th scope="col" className={HEAD}>آخرین اصلاح اسناد</th>
          </tr>
        </thead>

        <tbody>
          {records.map((record) => {
            const price = formatRial(record.reservePrice);

            return (
              <tr key={record.partyId} className="group hover:bg-raised">
                <td
                  className={cn(
                    CELL,
                    "sticky start-0 z-10 whitespace-nowrap border-e border-line bg-surface group-hover:bg-raised",
                  )}
                >
                  <span className="font-semibold">
                    {formatCount(record.snapshotRow)}
                  </span>
                  {/* Our page number is not setadiran's — this is theirs. */}
                  <span className="block text-xs text-subtle">
                    ص {formatCount(record.snapshotPage)} ستاد
                  </span>
                </td>

                <td className={cn(CELL, "whitespace-nowrap")}>
                  <Link
                    href={`/auction/${record.auctionId}`}
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    {toPersianDigits(record.auctionNo || record.auctionId)}
                  </Link>
                </td>

                <td className={CELL}>
                  {record.auctioneerName ? (
                    <TruncatedText className="max-w-56">
                      {record.auctioneerName}
                    </TruncatedText>
                  ) : (
                    NONE
                  )}
                </td>
                <td className={CELL}>
                  {record.auctioneerProvince ? (
                    <TruncatedText className="max-w-36">
                      {record.auctioneerProvince}
                    </TruncatedText>
                  ) : (
                    NONE
                  )}
                </td>

                <td className={cn(CELL, "whitespace-nowrap")}>
                  <Link
                    href={`/party/${record.partyId}`}
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    {toPersianDigits(record.partyNo || record.partyId)}
                  </Link>
                </td>

                <td className={CELL}>
                  {record.title ? (
                    <TruncatedText className="max-w-64">
                      {record.title}
                    </TruncatedText>
                  ) : (
                    NONE
                  )}
                </td>

                <td className={CELL}>
                  {record.lotProvince ? (
                    <>
                      <TruncatedText className="max-w-36">
                        {record.lotProvince}
                      </TruncatedText>
                      {record.lotCity ? (
                        <TruncatedText className="max-w-36 text-xs text-subtle">
                          {record.lotCity}
                        </TruncatedText>
                      ) : null}
                    </>
                  ) : (
                    NONE
                  )}
                </td>
                <td className={CELL}>
                  {record.goodsGroup ? (
                    <TruncatedText className="max-w-44">
                      {record.goodsGroup}
                    </TruncatedText>
                  ) : (
                    NONE
                  )}
                </td>
                <td className={cn(CELL, "whitespace-nowrap")}>
                  {price ?? NONE}
                </td>

                <td className={CELL}>
                  <DateRange from={record.publishFrom} to={record.publishTo} />
                </td>
                <td className={CELL}>
                  <DateRange from={record.proposalFrom} to={record.proposalTo} />
                </td>

                <td className={cn(CELL, "whitespace-nowrap")}>
                  {formatJalaliDate(record.lastInfoModified) ?? NONE}
                </td>
                <td className={cn(CELL, "whitespace-nowrap")}>
                  {formatJalaliDate(record.lastDocModified) ?? NONE}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

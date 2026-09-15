import { toPersianDigits } from "@/lib/format/digits";
import { formatJalaliDate, formatJalaliDateTime } from "@/lib/format/jalali";
import { formatRial } from "@/lib/format/number";

import type { AuctionRecord, DetailField } from "./types";

/**
 * Detail pages are built from the snapshot row rather than setadiran's own
 * detail endpoints, which production cannot reach. These are the fields the
 * list payload carries; the item grid and deposit amount live only upstream.
 */
function field(label: string, value: string | null): DetailField | null {
  return value ? { label, value } : null;
}

function present(fields: (DetailField | null)[]): DetailField[] {
  return fields.filter((entry): entry is DetailField => entry !== null);
}

/** Auction-level only — the fields every lot in the auction shares. */
export function auctionFields(record: AuctionRecord): DetailField[] {
  return present([
    field("شماره مزایده", toPersianDigits(record.auctionNo)),
    field("دستگاه مزایده‌گزار", record.auctioneerName),
    field("استان دستگاه", record.auctioneerProvince),
    field("تاریخ انتشار", formatJalaliDateTime(record.publishFrom)),
    field("پایان انتشار", formatJalaliDateTime(record.publishTo)),
    field("شروع ارسال پیشنهاد", formatJalaliDateTime(record.proposalFrom)),
    field("مهلت ارسال پیشنهاد", formatJalaliDateTime(record.proposalTo)),
    field("آخرین اصلاح اطلاعات", formatJalaliDate(record.lastInfoModified)),
    field("آخرین اصلاح اسناد", formatJalaliDate(record.lastDocModified)),
  ]);
}

export function lotFields(record: AuctionRecord): DetailField[] {
  return present([
    field("شماره پارتی", toPersianDigits(record.partyNo)),
    field("شرح پارتی", record.title),
    field("وضعیت", record.state),
    field("گروه کالا", record.goodsGroup),
    field("قیمت پایه (ریال)", formatRial(record.reservePrice)),
    field("استان پارتی", record.lotProvince),
    field("شهر پارتی", record.lotCity),
    field("شماره مزایده", toPersianDigits(record.auctionNo)),
    field("دستگاه مزایده‌گزار", record.auctioneerName),
    field("مهلت ارسال پیشنهاد", formatJalaliDateTime(record.proposalTo)),
    field("تاریخ انتشار", formatJalaliDateTime(record.publishFrom)),
    field("آخرین اصلاح اطلاعات", formatJalaliDate(record.lastInfoModified)),
  ]);
}

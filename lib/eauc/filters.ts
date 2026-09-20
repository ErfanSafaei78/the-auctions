import { toLatinDigits, toPersianDigits } from "@/lib/format/digits";
import {
  getJalaliDateInDays,
  getTodayJalali,
  jalaliInputToSortKey,
  jalaliSortKey,
} from "@/lib/format/jalali";

import type { AuctionRecord } from "./types";

/** Sentinel for the lots that carry no goods group upstream. */
export const NO_GROUP = "__none__";

export type DeadlinePreset = "all" | "open" | "soon";
export type TriState = "any" | "yes" | "no";

/**
 * Relative shorthands for the "new since" filter, each an offset in days back
 * from today. Every one is open-ended towards now — "yesterday" means *since*
 * yesterday, not yesterday alone, because the whole point is catching up on
 * days you did not look. The counts are inclusive of today, so "3d" is three
 * calendar days: today and the two before it.
 */
export const SINCE_OFFSET_DAYS = {
  today: 0,
  yesterday: -1,
  "3d": -2,
  "7d": -6,
} as const;

export type SinceKeyword = keyof typeof SINCE_OFFSET_DAYS;

const SINCE_KEYWORDS = Object.keys(SINCE_OFFSET_DAYS) as SinceKeyword[];

export function isSinceKeyword(value: string): value is SinceKeyword {
  return (SINCE_KEYWORDS as string[]).includes(value);
}

export interface AuctionFilters {
  auctionNo: string;
  lotNo: string;
  goodsGroups: string[];
  lotProvinces: string[];
  lotCities: string[];
  hasReservePrice: TriState;
  deadlinePreset: DeadlinePreset;
  deadlineFrom: string;
  deadlineTo: string;
  /**
   * Lots first seen on or after this date. Either a SinceKeyword, which stays
   * relative so a bookmarked filter keeps meaning what it says, or a literal
   * Jalali date, which stays fixed so a Telegram message sent days ago still
   * opens the list it announced. Empty means no first-seen filtering.
   */
  since: string;
}

export const EMPTY_FILTERS: AuctionFilters = {
  auctionNo: "",
  lotNo: "",
  goodsGroups: [],
  lotProvinces: [],
  lotCities: [],
  hasReservePrice: "any",
  deadlinePreset: "all",
  deadlineFrom: "",
  deadlineTo: "",
  since: "",
};

export const PER_PAGE_OPTIONS = [30, 50, 100] as const;
export const DEFAULT_PER_PAGE = 30;

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function many(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function asTriState(value: string): TriState {
  return value === "yes" || value === "no" ? value : "any";
}

function asPreset(value: string): DeadlinePreset {
  return value === "open" || value === "soon" ? value : "all";
}

export function parseAuctionFilters(params: SearchParams): AuctionFilters {
  return {
    auctionNo: one(params, "auctionNo").trim(),
    lotNo: one(params, "lotNo").trim(),
    goodsGroups: many(params, "group"),
    lotProvinces: many(params, "province"),
    lotCities: many(params, "city"),
    hasReservePrice: asTriState(one(params, "price")),
    deadlinePreset: asPreset(one(params, "deadline")),
    deadlineFrom: one(params, "from").trim(),
    deadlineTo: one(params, "to").trim(),
    since: one(params, "since").trim(),
  };
}

export function parsePagination(params: SearchParams) {
  const rawPage = Number.parseInt(one(params, "page"), 10);
  const rawPerPage = Number.parseInt(one(params, "perPage"), 10);

  const perPage = (PER_PAGE_OPTIONS as readonly number[]).includes(rawPerPage)
    ? rawPerPage
    : DEFAULT_PER_PAGE;

  return {
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    perPage,
  };
}

export function buildAuctionQuery(
  filters: AuctionFilters,
  page: number,
  perPage: number,
) {
  const params = new URLSearchParams();

  if (filters.auctionNo) params.set("auctionNo", filters.auctionNo);
  if (filters.lotNo) params.set("lotNo", filters.lotNo);
  for (const group of filters.goodsGroups) params.append("group", group);
  for (const province of filters.lotProvinces) params.append("province", province);
  for (const city of filters.lotCities) params.append("city", city);
  if (filters.hasReservePrice !== "any") params.set("price", filters.hasReservePrice);
  if (filters.deadlinePreset !== "all") params.set("deadline", filters.deadlinePreset);
  if (filters.deadlineFrom) params.set("from", filters.deadlineFrom);
  if (filters.deadlineTo) params.set("to", filters.deadlineTo);
  if (filters.since) params.set("since", filters.since);
  if (page > 1) params.set("page", String(page));
  if (perPage !== DEFAULT_PER_PAGE) params.set("perPage", String(perPage));

  return params.toString();
}

export function countActiveFilters(filters: AuctionFilters) {
  let count = 0;

  if (filters.auctionNo) count += 1;
  if (filters.lotNo) count += 1;
  if (filters.goodsGroups.length > 0) count += 1;
  if (filters.lotProvinces.length > 0) count += 1;
  if (filters.lotCities.length > 0) count += 1;
  if (filters.hasReservePrice !== "any") count += 1;
  if (filters.deadlinePreset !== "all") count += 1;
  if (filters.deadlineFrom || filters.deadlineTo) count += 1;
  if (filters.since) count += 1;

  return count;
}

/** Short human label for a filter set, used on the Telegram subscribe button and in notification messages. */
export function summarizeFilters(filters: AuctionFilters): string {
  const parts: string[] = [];

  if (filters.goodsGroups.length > 0) parts.push(filters.goodsGroups.join("، "));
  if (filters.lotProvinces.length > 0) parts.push(filters.lotProvinces.join("، "));
  if (filters.lotCities.length > 0) parts.push(filters.lotCities.join("، "));
  if (filters.hasReservePrice !== "any") {
    parts.push(
      filters.hasReservePrice === "yes" ? "قیمت پایه دارد" : "بدون قیمت پایه",
    );
  }
  if (filters.deadlinePreset === "open") parts.push("مهلت در جریان");
  if (filters.deadlinePreset === "soon") parts.push("مهلت تا ۷ روز");
  if (filters.deadlineFrom || filters.deadlineTo) {
    parts.push(`مهلت ${filters.deadlineFrom || "…"} تا ${filters.deadlineTo || "…"}`);
  }
  if (filters.since) parts.push(`جدید از ${describeSince(filters.since)}`);
  if (filters.auctionNo) parts.push(`مزایده ${filters.auctionNo}`);
  if (filters.lotNo) parts.push(`پارتی ${filters.lotNo}`);

  return parts.length > 0 ? parts.join(" · ") : "همه پارتی‌ها";
}

/** Persian label for a `since` value, keyword or literal date. */
export function describeSince(since: string): string {
  if (!since) return "";

  const labels: Record<SinceKeyword, string> = {
    today: "امروز",
    yesterday: "دیروز",
    "3d": "۳ روز اخیر",
    "7d": "۷ روز اخیر",
  };

  if (isSinceKeyword(since)) return labels[since];

  // A bare date means the start of that day, so say so instead of leaving the
  // time off and letting "1405/06/29" read like the whole day.
  const key = jalaliInputToSortKey(since);
  if (!key) return toPersianDigits(since);

  return toPersianDigits(
    `${key.slice(0, 4)}/${key.slice(4, 6)}/${key.slice(6, 8)} ${key.slice(8, 10)}:${key.slice(10)}`,
  );
}

/**
 * Every "now"-relative date the filters need, resolved once per request.
 *
 * Computed on the server and passed down rather than read from the clock
 * during filtering: the same records must filter identically on the server
 * and on the client, or the first render after hydration would disagree with
 * the HTML it replaced.
 */
export interface FilterWindow {
  /** Jalali "YYYY/MM/DD" for today in Tehran. */
  today: string;
  /** Jalali "YYYY/MM/DD" seven days out. */
  inSevenDays: string;
  /** The Jalali date each `since` keyword stands for. */
  since: Record<SinceKeyword, string>;
}

export function buildFilterWindow(): FilterWindow {
  const since = {} as Record<SinceKeyword, string>;
  for (const keyword of SINCE_KEYWORDS) {
    since[keyword] = getJalaliDateInDays(SINCE_OFFSET_DAYS[keyword]);
  }

  return {
    today: getTodayJalali(),
    inSevenDays: getJalaliDateInDays(7),
    since,
  };
}

export function applyAuctionFilters(
  records: AuctionRecord[],
  filters: AuctionFilters,
  window: FilterWindow,
): AuctionRecord[] {
  // Upstream ids are ASCII digits; typed input may be Persian/Arabic-Indic
  // digits (fa locale), so both sides need to agree before comparing.
  const auctionNo = toLatinDigits(filters.auctionNo);
  const lotNo = toLatinDigits(filters.lotNo);
  const groups = new Set(filters.goodsGroups);
  const provinces = new Set(filters.lotProvinces);
  const cities = new Set(filters.lotCities);

  const todayStart = jalaliInputToSortKey(window.today) ?? "";
  const todayEnd = jalaliInputToSortKey(window.today, true) ?? "";
  const soonEnd = jalaliInputToSortKey(window.inSevenDays, true) ?? "";
  const fromKey = filters.deadlineFrom
    ? jalaliInputToSortKey(filters.deadlineFrom)
    : null;
  const toKey = filters.deadlineTo
    ? jalaliInputToSortKey(filters.deadlineTo, true)
    : null;

  // A keyword resolves through the window; anything else is read as a literal
  // Jalali date. An unparseable value yields null and filters nothing, so a
  // mangled ?since= shows the whole board rather than an empty one.
  const sinceKey = filters.since
    ? jalaliInputToSortKey(
        isSinceKeyword(filters.since)
          ? window.since[filters.since]
          : filters.since,
      )
    : null;

  return records.filter((record) => {
    if (auctionNo && !record.auctionNo.includes(auctionNo)) return false;
    if (lotNo && !record.partyNo.includes(lotNo)) return false;

    if (groups.size > 0) {
      const key = record.goodsGroup ?? NO_GROUP;
      if (!groups.has(key)) return false;
    }

    if (provinces.size > 0 && !provinces.has(record.lotProvince)) return false;
    if (cities.size > 0 && !cities.has(record.lotCity)) return false;

    if (filters.hasReservePrice === "yes" && record.reservePrice === null) {
      return false;
    }
    if (filters.hasReservePrice === "no" && record.reservePrice !== null) {
      return false;
    }

    // Jalali strings are fixed-width, so these key comparisons are date
    // comparisons — no calendar conversion anywhere.
    const closesAt = jalaliSortKey(record.proposalTo);
    const opensAt = jalaliSortKey(record.proposalFrom);

    if (filters.deadlinePreset === "open") {
      if (!closesAt || closesAt < todayStart) return false;
      if (opensAt && opensAt > todayEnd) return false;
    }

    if (filters.deadlinePreset === "soon") {
      if (!closesAt) return false;
      if (closesAt < todayStart || closesAt > soonEnd) return false;
    }

    if (fromKey && (!closesAt || closesAt < fromKey)) return false;
    if (toKey && (!closesAt || closesAt > toKey)) return false;

    if (sinceKey) {
      // Unstamped records predate the field, so they are old by definition.
      const firstSeen = jalaliSortKey(record.firstSeenAtJalali ?? null);
      if (!firstSeen || firstSeen < sinceKey) return false;
    }

    return true;
  });
}

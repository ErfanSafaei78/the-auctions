import { getJalaliStamp } from "@/lib/format/jalali";

import { SETADIRAN_ROWS_PER_PAGE } from "./constants";
import type { RawListResponse } from "./list";
import type {
  AuctionRecord,
  AuctionSnapshot,
  SnapshotFacets,
} from "./types";

type Unknown = Record<string, unknown>;

function asRecord(value: unknown): Unknown | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Unknown)
    : null;
}

function dig(source: unknown, ...path: string[]): unknown {
  let current: unknown = source;

  for (const key of path) {
    const record = asRecord(current);
    if (!record) return null;
    current = record[key];
    if (current === null || current === undefined) return null;
  }

  return current;
}

function str(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  return null;
}

export function normalizeListRow(
  raw: unknown,
  index: number,
): AuctionRecord | null {
  const row = asRecord(raw);
  if (!row) return null;

  const auctionId = str(dig(row, "auctionParty", "auction", "id"));
  const partyId = str(dig(row, "auctionParty", "id"));
  if (!auctionId || !partyId) return null;

  return {
    auctionId,
    partyId,
    auctionNo: str(dig(row, "auctionParty", "auction", "auctionNo")) ?? "",
    partyNo: str(dig(row, "auctionParty", "partyNo")) ?? "",
    title:
      str(dig(row, "auctionParty", "title")) ??
      str(dig(row, "auctionParty", "auction", "title")) ??
      "",
    auctioneerName:
      str(dig(row, "auctionParty", "auction", "auctioneer", "name")) ?? "",
    auctioneerProvince:
      str(
        dig(
          row,
          "auctionParty",
          "auction",
          "auctioneer",
          "city",
          "province",
          "name",
        ),
      ) ?? "",
    lotProvince:
      str(dig(row, "auctionParty", "visitCity", "province", "name")) ?? "",
    lotCity: str(dig(row, "auctionParty", "visitCity", "name")) ?? "",
    // partyGroups sits on the row, not on auctionParty.
    goodsGroup: str(row.partyGroups),
    reservePrice: num(dig(row, "auctionParty", "baseTotalPrice")),
    publishFrom: str(dig(row, "auctionParty", "auction", "fromSiteShowDate")),
    publishTo: str(dig(row, "auctionParty", "auction", "toSiteShowDate")),
    proposalFrom: str(dig(row, "auctionParty", "auction", "fromProposalDate")),
    proposalTo: str(dig(row, "auctionParty", "auction", "toProposalDate")),
    lastInfoModified: str(dig(row, "auctionParty", "auction", "lastModifyDate")),
    lastDocModified: str(
      dig(row, "auctionParty", "auction", "lastAuctionDocumentModifyDate"),
    ),
    state: str(dig(row, "auctionParty", "state")),
    // Frozen here, as data. Filtering and paging only ever subset the array,
    // so these can never drift from what setadiran shows.
    snapshotRow: index + 1,
    snapshotPage: Math.floor(index / SETADIRAN_ROWS_PER_PAGE) + 1,
  };
}

function buildFacets(records: AuctionRecord[]): SnapshotFacets {
  const collator = new Intl.Collator("fa");
  const groups = new Set<string>();
  const provinces = new Set<string>();
  const cities = new Map<string, Set<string>>();

  for (const record of records) {
    if (record.goodsGroup) groups.add(record.goodsGroup);
    if (!record.lotProvince) continue;

    provinces.add(record.lotProvince);
    if (!record.lotCity) continue;

    const bucket = cities.get(record.lotProvince) ?? new Set<string>();
    bucket.add(record.lotCity);
    cities.set(record.lotProvince, bucket);
  }

  const citiesByProvince: Record<string, string[]> = {};
  for (const [province, bucket] of cities) {
    citiesByProvince[province] = [...bucket].sort(collator.compare);
  }

  return {
    goodsGroups: [...groups].sort(collator.compare),
    lotProvinces: [...provinces].sort(collator.compare),
    citiesByProvince,
  };
}

export function buildSnapshot(
  raw: RawListResponse,
  fetchedAt: Date,
): AuctionSnapshot {
  const records = raw.gridModel
    .map((row, index) => normalizeListRow(row, index))
    .filter((record): record is AuctionRecord => record !== null);

  return {
    version: 1,
    fetchedAt: fetchedAt.toISOString(),
    fetchedAtJalali: getJalaliStamp(fetchedAt),
    upstreamRecords: raw.records,
    records,
    facets: buildFacets(records),
  };
}

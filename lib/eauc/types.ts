/**
 * One منقول lot, flattened from the upstream grid row.
 *
 * Ids are strings: upstream auction/lot numbers exceed Number.MAX_SAFE_INTEGER
 * and are only ever compared or interpolated, never computed with.
 *
 * Dates are raw Jalali strings ("1405/07/14 19:00:00") and are never converted.
 * The format is zero-padded and fixed-width, so lexicographic order is
 * chronological order.
 */
export interface AuctionRecord {
  auctionId: string;
  partyId: string;
  auctionNo: string;
  partyNo: string;
  title: string;
  auctioneerName: string;
  auctioneerProvince: string;
  lotProvince: string;
  lotCity: string;
  goodsGroup: string | null;
  reservePrice: number | null;
  publishFrom: string | null;
  publishTo: string | null;
  proposalFrom: string | null;
  proposalTo: string | null;
  lastInfoModified: string | null;
  lastDocModified: string | null;
  state: string | null;
  /** 1-based position in the upstream snapshot. Frozen at normalize time. */
  snapshotRow: number;
  /** Which setadiran page (30 rows each) this lot appears on. Frozen. */
  snapshotPage: number;
}

export interface SnapshotFacets {
  goodsGroups: string[];
  lotProvinces: string[];
  /** Province name -> its cities, for dependent narrowing of the city filter. */
  citiesByProvince: Record<string, string[]>;
}

export interface AuctionSnapshot {
  version: 1;
  /** ISO-8601 UTC. */
  fetchedAt: string;
  /** Precomputed Tehran-local Jalali stamp, so no client conversion is needed. */
  fetchedAtJalali: string;
  /** `records` as reported by the upstream grid, before normalization. */
  upstreamRecords: number;
  records: AuctionRecord[];
  facets: SnapshotFacets;
}

export interface LotItem {
  title: string;
  amount: string;
  unit: string;
  group: string;
}

export interface DetailField {
  label: string;
  value: string;
}

export interface AuctionDetail {
  fields: DetailField[];
  depositAmount: string | null;
}

export interface LotDetail {
  fields: DetailField[];
  depositAmount: string | null;
  /** null when the item grid could not be loaded — not the same as no items. */
  items: LotItem[] | null;
}

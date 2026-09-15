import { LIST_PAGE_SIZE, LIST_URL } from "./constants";
import { eaucGet, looksLikeHtmlError, type EaucResponse } from "./http";
import { withEaucSession } from "./session";

export interface RawListResponse {
  gridModel: unknown[];
  records: number;
}

/**
 * Shared by our own fetch and by /api/ingest, which receives this same upstream
 * payload from a runner with Iranian egress rather than reading it directly.
 */
export function coerceListPayload(payload: unknown): RawListResponse {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Auction list payload was not an object.");
  }

  const { gridModel, records } = payload as {
    gridModel?: unknown;
    records?: unknown;
  };

  if (!Array.isArray(gridModel)) {
    throw new Error("Auction list payload had no gridModel array.");
  }

  return {
    gridModel,
    records: typeof records === "number" ? records : gridModel.length,
  };
}

function parseListPayload(response: EaucResponse): RawListResponse {
  return coerceListPayload(JSON.parse(response.text));
}

/** The list body is ~600 KB, so it gets more room than a detail request. */
const LIST_TIMEOUT_MS = 30_000;

async function fetchListPage(page: number) {
  const url = `${LIST_URL}?rows=${LIST_PAGE_SIZE}&page=${page}`;

  const response = await withEaucSession(
    (jar) => eaucGet(jar, url, LIST_TIMEOUT_MS),
    looksLikeHtmlError,
  );

  if (looksLikeHtmlError(response)) {
    throw new Error(
      `Auction list request failed (status ${response.status}, ${response.contentType ?? "unknown type"}).`,
    );
  }

  return parseListPayload(response);
}

/** Runaway guard only: 20 x 5000 = 100,000 rows, ~100x the current size. */
const MAX_LIST_PAGES = 20;

/**
 * Fetches every row, not a fixed number of pages.
 *
 * One request asks for LIST_PAGE_SIZE (5000) rows, which covers the whole
 * category in a single round trip today (~970 rows), so the loop below
 * normally never runs. It exists so that if the board ever grows past 5000
 * rows we keep paging until `records` is satisfied rather than silently
 * truncating.
 */
export async function fetchAuctionList(): Promise<RawListResponse> {
  const first = await fetchListPage(1);
  const rows = [...first.gridModel];

  let page = 2;
  while (rows.length < first.records && page <= MAX_LIST_PAGES) {
    const next = await fetchListPage(page);
    if (next.gridModel.length === 0) break;
    rows.push(...next.gridModel);
    page += 1;
  }

  if (rows.length < first.records) {
    throw new Error(
      `Auction list truncated: got ${rows.length} of ${first.records} rows.`,
    );
  }

  return { gridModel: rows, records: first.records };
}

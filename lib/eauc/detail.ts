import {
  AUCTION_DETAIL_URL,
  BACK_ACTION_NAME,
  DEPOSIT_CAPTION,
  LOT_DETAIL_URL,
  LOT_ITEMS_URL,
} from "./constants";
import {
  eaucGet,
  eaucPost,
  looksLikeHtmlError,
  type CookieJar,
  type EaucResponse,
} from "./http";
import {
  extractValueAfterCaption,
  parseLabeledFields,
  parseLotItems,
} from "./parse-detail";
import { getEaucSession, withEaucSession } from "./session";
import type { AuctionDetail, LotDetail, LotItem } from "./types";

export class EaucDetailError extends Error {}

export async function fetchAuctionDetail(
  auctionId: string,
): Promise<AuctionDetail> {
  const response = await withEaucSession(
    (jar) =>
      eaucPost(jar, AUCTION_DETAIL_URL, {
        auctionId,
        backActionName: BACK_ACTION_NAME,
      }),
    looksLikeHtmlError,
  );

  if (looksLikeHtmlError(response)) {
    throw new EaucDetailError(
      `Auction ${auctionId} request failed (status ${response.status}).`,
    );
  }

  const fields = parseLabeledFields(response.text);
  if (fields.length === 0) {
    throw new EaucDetailError(`Auction ${auctionId} returned no parsable fields.`);
  }

  return {
    fields,
    depositAmount: extractValueAfterCaption(response.text, DEPOSIT_CAPTION),
  };
}

function requestLotDetail(jar: CookieJar, partyId: string) {
  return eaucPost(jar, LOT_DETAIL_URL, {
    auctionPartyId: partyId,
    backActionName: BACK_ACTION_NAME,
  });
}

/** The item grid is secondary: its failure must not take the page down. */
function requestLotItems(jar: CookieJar, partyId: string) {
  return eaucGet(
    jar,
    `${LOT_ITEMS_URL}?auctionPartyId=${partyId}&rows=500&page=1`,
  ).catch(() => null);
}

function parseItemsResponse(response: EaucResponse | null): LotItem[] | null {
  if (!response || looksLikeHtmlError(response)) return null;

  try {
    return parseLotItems(JSON.parse(response.text));
  } catch {
    return null;
  }
}

/**
 * Verified against production: this endpoint keys solely off auctionPartyId.
 * Omitting auctionId, or sending a wrong one, still returns the correct lot —
 * which is what lets /party/{partyId} stand on its own.
 */
export async function fetchLotDetail(partyId: string): Promise<LotDetail> {
  const jar = await getEaucSession();

  let [detail, itemsResponse] = await Promise.all([
    requestLotDetail(jar, partyId),
    requestLotItems(jar, partyId),
  ]);

  // An expired pooled session fails both requests at once, so both retry on
  // the fresh session. Retrying only the detail would render the lot's real
  // item list as "no items".
  if (looksLikeHtmlError(detail)) {
    const freshJar = await getEaucSession({ force: true });
    [detail, itemsResponse] = await Promise.all([
      requestLotDetail(freshJar, partyId),
      requestLotItems(freshJar, partyId),
    ]);
  }

  if (looksLikeHtmlError(detail)) {
    throw new EaucDetailError(
      `Lot ${partyId} request failed (status ${detail.status}).`,
    );
  }

  const fields = parseLabeledFields(detail.text);
  if (fields.length === 0) {
    throw new EaucDetailError(`Lot ${partyId} returned no parsable fields.`);
  }

  return {
    fields,
    depositAmount: extractValueAfterCaption(detail.text, DEPOSIT_CAPTION),
    items: parseItemsResponse(itemsResponse),
  };
}

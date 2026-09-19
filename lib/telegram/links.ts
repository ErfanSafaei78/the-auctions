import "server-only";

import {
  buildAuctionQuery,
  DEFAULT_PER_PAGE,
  type AuctionFilters,
} from "@/lib/eauc/filters";

import { siteOrigin } from "./config";

/**
 * The board, already filtered — the same URL the site would produce for those
 * filters, so it restores the exact view the subscription was built from.
 *
 * null when no absolute origin is configured: a Telegram URL button is
 * rejected outright if the URL is relative, and a relative <a href> in a
 * message body is dead text, so both callers drop the link instead.
 */
export function boardUrl(filters: AuctionFilters): string | null {
  const origin = siteOrigin();
  if (!origin) return null;

  return `${origin}/?${buildAuctionQuery(filters, 1, DEFAULT_PER_PAGE)}`;
}

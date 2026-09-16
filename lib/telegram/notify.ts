import "server-only";

import {
  applyAuctionFilters,
  buildAuctionQuery,
  type AuctionFilters,
} from "@/lib/eauc/filters";
import type { AuctionRecord, AuctionSnapshot } from "@/lib/eauc/types";
import { getJalaliDateInDays, getTodayJalali } from "@/lib/format/jalali";

import { escapeHtml, sendTelegramMessage } from "./bot";
import { isTelegramConfigured, siteOrigin } from "./config";
import { markNotified, readSubscriptions } from "./store";
import type { TelegramSubscription } from "./types";

const MAX_TITLES_IN_MESSAGE = 5;

/**
 * Lots present now but not in the previous snapshot. With no previous
 * snapshot (the very first sync ever) every record would read as "new" and
 * flood every subscriber at once, so that case notifies nobody instead.
 */
function findNewRecords(
  previous: AuctionSnapshot | null,
  next: AuctionSnapshot,
): AuctionRecord[] {
  if (!previous) return [];

  const seen = new Set(previous.records.map((record) => record.partyId));
  return next.records.filter((record) => !seen.has(record.partyId));
}

function buildMessage(
  label: string,
  matches: AuctionRecord[],
  filters: AuctionFilters,
) {
  const origin = siteOrigin();
  const query = buildAuctionQuery(filters, 1, 30);
  const link = origin ? `${origin}/?${query}` : `/?${query}`;

  const titles = matches
    .slice(0, MAX_TITLES_IN_MESSAGE)
    .map((record) => `• ${escapeHtml(record.title || record.partyNo)}`)
    .join("\n");

  const more =
    matches.length > MAX_TITLES_IN_MESSAGE
      ? `\n… و ${matches.length - MAX_TITLES_IN_MESSAGE} مورد دیگر`
      : "";

  return (
    `<b>${matches.length} پارتی جدید</b> مطابق «${escapeHtml(label)}»\n\n` +
    `${titles}${more}\n\n` +
    `<a href="${link}">مشاهده در تابلو</a>`
  );
}

/**
 * Called from commitSnapshot after a successful write — the one place every
 * new sync, direct or pushed, converges. Failure here must never affect the
 * snapshot write itself, so every caller wraps this in its own try/catch.
 */
export async function notifyNewAuctions(
  previous: AuctionSnapshot | null,
  next: AuctionSnapshot,
): Promise<void> {
  if (!isTelegramConfigured()) return;

  const newRecords = findNewRecords(previous, next);
  if (newRecords.length === 0) return;

  const subscriptions = await readSubscriptions();
  const linked = subscriptions.filter(
    (subscription): subscription is TelegramSubscription & { chatId: number } =>
      subscription.chatId !== null,
  );
  if (linked.length === 0) return;

  const window = { today: getTodayJalali(), inSevenDays: getJalaliDateInDays(7) };
  const notifiedIds: string[] = [];

  const results = await Promise.allSettled(
    linked.map(async (subscription) => {
      const matches = applyAuctionFilters(newRecords, subscription.filters, window);
      if (matches.length === 0) return;

      await sendTelegramMessage(
        subscription.chatId,
        buildMessage(subscription.label, matches, subscription.filters),
      );
      notifiedIds.push(subscription.id);
    }),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Telegram notify failed for a subscription", result.reason);
    }
  }

  await markNotified(notifiedIds, next.fetchedAt);
}

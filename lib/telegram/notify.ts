import "server-only";

import {
  applyAuctionFilters,
  buildFilterWindow,
  type AuctionFilters,
} from "@/lib/eauc/filters";
import type { AuctionRecord, AuctionSnapshot } from "@/lib/eauc/types";
import { toPersianDigits } from "@/lib/format/digits";

import { escapeHtml, sendTelegramMessage } from "./bot";
import { isTelegramConfigured } from "./config";
import { boardUrl } from "./links";
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
  since: string,
) {
  // The lots below were stamped with this sync's date, so pinning the link to
  // it is what keeps an old message honest: opened days later it still lists
  // what it announced, plus anything new since — which is the whole point of
  // tapping yesterday's message. A relative "today" would instead go empty.
  const link = boardUrl({ ...filters, since });

  const titles = matches
    .slice(0, MAX_TITLES_IN_MESSAGE)
    .map((record) => `• ${escapeHtml(record.title || record.partyNo)}`)
    .join("\n");

  const more =
    matches.length > MAX_TITLES_IN_MESSAGE
      ? `\n… و ${matches.length - MAX_TITLES_IN_MESSAGE} مورد دیگر`
      : "";

  return (
    `<b>${toPersianDigits(String(matches.length))} پارتی جدید</b> مطابق «${escapeHtml(label)}»\n\n` +
    `${titles}${more}` +
    (link
      ? `\n\n<a href="${link}">مشاهده همه ${toPersianDigits(String(matches.length))} مورد در تابلو</a>`
      : "")
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

  const window = buildFilterWindow();
  // Every record new in this sync carries exactly this stamp — see
  // buildSnapshot — so a link pinned to it resolves to these lots and no
  // others, even if another sync runs later the same day.
  const sinceDate = next.fetchedAtJalali;
  const notifiedIds: string[] = [];

  const results = await Promise.allSettled(
    linked.map(async (subscription) => {
      const matches = applyAuctionFilters(newRecords, subscription.filters, window);
      if (matches.length === 0) return;

      await sendTelegramMessage(
        subscription.chatId,
        buildMessage(
          subscription.label,
          matches,
          subscription.filters,
          sinceDate,
        ),
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

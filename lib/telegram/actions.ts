"use server";

import { summarizeFilters, type AuctionFilters } from "@/lib/eauc/filters";

import { isTelegramConfigured, telegramBotUsername } from "./config";
import { createPendingSubscription } from "./store";

export type CreateSubscriptionResult =
  | { status: "created"; startUrl: string }
  | { status: "unavailable" };

/**
 * Saves the current board filters as a pending subscription (no chat linked
 * yet) and hands back a Telegram deep link. The bot links the chat once the
 * user taps it and it reaches /start — see app/api/telegram/webhook.
 */
export async function createTelegramSubscriptionAction(
  filters: AuctionFilters,
): Promise<CreateSubscriptionResult> {
  if (!isTelegramConfigured()) return { status: "unavailable" };

  // `since` is dropped: a subscription only ever reports lots that are new, so
  // storing a first-seen window would either say nothing (a relative keyword
  // that always matches) or, with a literal date, silently narrow every future
  // notification against a date the subscriber picked once. It belongs in the
  // link a notification carries, not in what the subscription matches on.
  const matchOn: AuctionFilters = { ...filters, since: "" };

  const label = summarizeFilters(matchOn);
  const subscription = await createPendingSubscription(matchOn, label);
  const username = telegramBotUsername();

  return {
    status: "created",
    startUrl: `https://t.me/${username}?start=${subscription.id}`,
  };
}

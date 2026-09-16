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

  const label = summarizeFilters(filters);
  const subscription = await createPendingSubscription(filters, label);
  const username = telegramBotUsername();

  return {
    status: "created",
    startUrl: `https://t.me/${username}?start=${subscription.id}`,
  };
}

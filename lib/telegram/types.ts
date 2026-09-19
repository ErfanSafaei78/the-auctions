import type { AuctionFilters } from "@/lib/eauc/filters";

export interface TelegramSubscription {
  id: string;
  /** null until the user taps the bot's /start deep link and links a chat. */
  chatId: number | null;
  label: string;
  filters: AuctionFilters;
  createdAt: string;
  lastNotifiedAt: string | null;
}

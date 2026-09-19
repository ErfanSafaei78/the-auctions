import "server-only";

import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";

import type { AuctionFilters } from "@/lib/eauc/filters";

import type { TelegramSubscription } from "./types";

/**
 * Redis, not Blob. Subscriptions are small records read back immediately
 * after they're written — the site creates one and the bot's /start looks it
 * up seconds later. Blob is CDN-fronted object storage: that read could
 * return an older copy, and its ifMatch didn't reliably stop two overlapping
 * writers from clobbering each other, so created subscriptions went missing
 * and valid links reported "invalid". Every write here is a single atomic
 * command, and a read after it sees it.
 */
const SUB_KEY = (id: string) => `telegram:sub:${id}`;
const CHAT_KEY = (chatId: number) => `telegram:chat:${chatId}`;
/** Every linked subscription, so notify can fan out without scanning keys. */
const LINKED_KEY = "telegram:linked";

/**
 * A subscription that's created but never opened in Telegram is dead weight —
 * the deep link is meant to be tapped within moments. Linking clears the TTL.
 */
const PENDING_TTL_SECONDS = 24 * 60 * 60;

let client: Redis | null = null;

export function isSubscriptionStoreConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function redis(): Redis {
  if (!client) {
    if (!isSubscriptionStoreConfigured()) {
      throw new Error("KV_REST_API_URL / KV_REST_API_TOKEN are not set");
    }
    client = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
  }
  return client;
}

/** mget on an empty key list is an error, and drops entries that expired meanwhile. */
async function readMany(ids: string[]): Promise<TelegramSubscription[]> {
  if (ids.length === 0) return [];

  const found = await redis().mget<(TelegramSubscription | null)[]>(
    ...ids.map(SUB_KEY),
  );
  return found.filter((item): item is TelegramSubscription => item !== null);
}

export async function readSubscriptions(): Promise<TelegramSubscription[]> {
  const ids = await redis().smembers(LINKED_KEY);
  return readMany(ids);
}

export async function createPendingSubscription(
  filters: AuctionFilters,
  label: string,
): Promise<TelegramSubscription> {
  const subscription: TelegramSubscription = {
    id: randomUUID().replace(/-/g, ""),
    chatId: null,
    label,
    filters,
    createdAt: new Date().toISOString(),
    lastNotifiedAt: null,
  };

  await redis().set(SUB_KEY(subscription.id), subscription, {
    ex: PENDING_TTL_SECONDS,
  });
  return subscription;
}

export type LinkResult =
  | { status: "linked"; subscription: TelegramSubscription }
  | { status: "not_found" };

/** Consumed from the bot's /start payload, so a stale or tampered id just misses. */
export async function linkSubscription(
  id: string,
  chatId: number,
): Promise<LinkResult> {
  const subscription = await redis().get<TelegramSubscription>(SUB_KEY(id));
  if (!subscription) return { status: "not_found" };

  const linked: TelegramSubscription = { ...subscription, chatId };

  // set without `ex` drops the pending TTL: this one is now permanent.
  await redis()
    .pipeline()
    .set(SUB_KEY(id), linked)
    .sadd(CHAT_KEY(chatId), id)
    .sadd(LINKED_KEY, id)
    .exec();

  return { status: "linked", subscription: linked };
}

export async function listSubscriptionsForChat(
  chatId: number,
): Promise<TelegramSubscription[]> {
  const ids = await redis().smembers(CHAT_KEY(chatId));
  return readMany(ids);
}

/** chatId is required so a chat can only ever delete its own subscriptions. */
export async function deleteSubscription(
  id: string,
  chatId: number,
): Promise<boolean> {
  const subscription = await redis().get<TelegramSubscription>(SUB_KEY(id));
  if (!subscription || subscription.chatId !== chatId) return false;

  await redis()
    .pipeline()
    .del(SUB_KEY(id))
    .srem(CHAT_KEY(chatId), id)
    .srem(LINKED_KEY, id)
    .exec();

  return true;
}

/**
 * Only ever called by the sync that just sent the messages — a lost update
 * here would at worst re-send one notification, so it needs no locking.
 */
export async function markNotified(ids: string[], when: string): Promise<void> {
  const subscriptions = await readMany(ids);
  if (subscriptions.length === 0) return;

  const pipeline = redis().pipeline();
  for (const subscription of subscriptions) {
    pipeline.set(SUB_KEY(subscription.id), {
      ...subscription,
      lastNotifiedAt: when,
    });
  }
  await pipeline.exec();
}

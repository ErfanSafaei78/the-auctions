import "server-only";

import { randomUUID } from "node:crypto";

import type { AuctionFilters } from "@/lib/eauc/filters";

import type { TelegramSubscription, TelegramSubscriptionStore } from "./types";

export const SUBSCRIPTIONS_PATHNAME = "auctions/telegram-subscriptions.json";
const LOCAL_PATH = ".cache/telegram-subscriptions.json";

const EMPTY_STORE: TelegramSubscriptionStore = { subscriptions: [] };

function hasBlobCredentials() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readLocal(): Promise<TelegramSubscriptionStore> {
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(LOCAL_PATH, "utf8");
    return {
      ...EMPTY_STORE,
      ...(JSON.parse(raw) as Partial<TelegramSubscriptionStore>),
    };
  } catch {
    return EMPTY_STORE;
  }
}

async function writeLocal(store: TelegramSubscriptionStore) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");

  await mkdir(dirname(LOCAL_PATH), { recursive: true });
  await writeFile(LOCAL_PATH, JSON.stringify(store), "utf8");
}

async function readStore(): Promise<TelegramSubscriptionStore> {
  if (!hasBlobCredentials()) return readLocal();

  const { head } = await import("@vercel/blob");

  try {
    const meta = await head(SUBSCRIPTIONS_PATHNAME);
    const response = await fetch(
      `${meta.url}?v=${meta.uploadedAt.getTime()}`,
      { cache: "no-store" },
    );
    if (!response.ok) return EMPTY_STORE;

    const parsed = (await response.json()) as Partial<TelegramSubscriptionStore>;
    return { ...EMPTY_STORE, ...parsed };
  } catch {
    return EMPTY_STORE;
  }
}

async function writeStore(store: TelegramSubscriptionStore) {
  if (!hasBlobCredentials()) return writeLocal(store);

  const { put } = await import("@vercel/blob");

  await put(SUBSCRIPTIONS_PATHNAME, JSON.stringify(store), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

/**
 * Best-effort read-modify-write, same tradeoff as sync-state.ts: write
 * volume here is one bot chat's worth of taps, so a lost race just means an
 * occasional retry, not corruption worth a real lock for.
 */
async function mutate<T>(
  fn: (store: TelegramSubscriptionStore) => T,
): Promise<T> {
  const store = await readStore();
  const result = fn(store);
  await writeStore(store);
  return result;
}

export async function readSubscriptions(): Promise<TelegramSubscription[]> {
  const store = await readStore();
  return store.subscriptions;
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

  return mutate((store) => {
    store.subscriptions.push(subscription);
    return subscription;
  });
}

export type LinkResult =
  | { status: "linked"; subscription: TelegramSubscription }
  | { status: "not_found" };

/** Consumed from the bot's /start payload, so a stale or tampered id just misses. */
export async function linkSubscription(
  id: string,
  chatId: number,
): Promise<LinkResult> {
  return mutate((store) => {
    const subscription = store.subscriptions.find((item) => item.id === id);
    if (!subscription) return { status: "not_found" };

    subscription.chatId = chatId;
    return { status: "linked", subscription };
  });
}

export async function listSubscriptionsForChat(
  chatId: number,
): Promise<TelegramSubscription[]> {
  const store = await readStore();
  return store.subscriptions.filter((item) => item.chatId === chatId);
}

/** chatId is required so a chat can only ever delete its own subscriptions. */
export async function deleteSubscription(
  id: string,
  chatId: number,
): Promise<boolean> {
  return mutate((store) => {
    const index = store.subscriptions.findIndex(
      (item) => item.id === id && item.chatId === chatId,
    );
    if (index === -1) return false;

    store.subscriptions.splice(index, 1);
    return true;
  });
}

export async function markNotified(
  ids: string[],
  when: string,
): Promise<void> {
  if (ids.length === 0) return;

  const idSet = new Set(ids);
  await mutate((store) => {
    for (const subscription of store.subscriptions) {
      if (idSet.has(subscription.id)) subscription.lastNotifiedAt = when;
    }
  });
}

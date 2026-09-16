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

interface StoreWithEtag {
  store: TelegramSubscriptionStore;
  /** undefined when the blob has never been written — nothing to match against yet. */
  etag: string | undefined;
}

/**
 * Throws on any failure except "never written yet" — used only by mutate().
 * A mutation must never treat a failed read as an empty store: EMPTY_STORE
 * plus an unconditional (no-etag) write would silently overwrite every
 * existing subscription with just the one this call is trying to add.
 */
async function readStoreWithEtag(): Promise<StoreWithEtag> {
  if (!hasBlobCredentials()) return { store: await readLocal(), etag: undefined };

  const { head, BlobNotFoundError } = await import("@vercel/blob");

  let meta;
  try {
    meta = await head(SUBSCRIPTIONS_PATHNAME);
  } catch (error) {
    if (error instanceof BlobNotFoundError) return { store: EMPTY_STORE, etag: undefined };
    throw error;
  }

  const response = await fetch(`${meta.url}?v=${meta.uploadedAt.getTime()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Telegram subscriptions blob fetch failed: ${response.status}`);
  }

  const parsed = (await response.json()) as Partial<TelegramSubscriptionStore>;
  return { store: { ...EMPTY_STORE, ...parsed }, etag: meta.etag };
}

/** Lenient, display-only read: degrades to "no subscriptions" on any error rather than throwing. */
async function readStore(): Promise<TelegramSubscriptionStore> {
  try {
    return (await readStoreWithEtag()).store;
  } catch (error) {
    console.error("Telegram subscriptions blob read failed", error);
    return EMPTY_STORE;
  }
}

async function writeStore(store: TelegramSubscriptionStore, ifMatch: string | undefined) {
  if (!hasBlobCredentials()) return writeLocal(store);

  const { put } = await import("@vercel/blob");

  await put(SUBSCRIPTIONS_PATHNAME, JSON.stringify(store), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
    // Compare-and-swap: only write if nobody else has written since we read.
    // Without this, two overlapping read-modify-write cycles (e.g. the site
    // creating a subscription and the bot linking a different one within
    // the same second) can each read a valid-looking copy and the slower
    // one's write silently discards the faster one's — observed live as a
    // freshly linked subscription's chatId reverting to null.
    ...(ifMatch ? { ifMatch } : {}),
  });
}

/** Retries a few times when a concurrent writer won the race, then gives up loudly. */
const MAX_MUTATE_ATTEMPTS = 5;

/**
 * `changed` gates the write deliberately: a lookup that found nothing to do
 * must never write back the store it just read — that would be a no-op CAS
 * write at best, and at worst races a concurrent writer for no reason.
 */
async function mutate<T>(
  fn: (store: TelegramSubscriptionStore) => { result: T; changed: boolean },
): Promise<T> {
  const { BlobPreconditionFailedError } = await import("@vercel/blob");

  for (let attempt = 1; attempt <= MAX_MUTATE_ATTEMPTS; attempt += 1) {
    const { store, etag } = await readStoreWithEtag();
    const { result, changed } = fn(store);
    if (!changed) return result;
    if (!hasBlobCredentials()) {
      await writeStore(store, undefined);
      return result;
    }

    try {
      await writeStore(store, etag);
      return result;
    } catch (error) {
      const isLastAttempt = attempt === MAX_MUTATE_ATTEMPTS;
      if (error instanceof BlobPreconditionFailedError && !isLastAttempt) {
        continue;
      }
      throw error;
    }
  }

  // Unreachable — the loop above always returns or throws.
  throw new Error("Telegram subscription store: exhausted retries");
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
    return { result: subscription, changed: true };
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
  return mutate<LinkResult>((store) => {
    const subscription = store.subscriptions.find((item) => item.id === id);
    if (!subscription) return { result: { status: "not_found" }, changed: false };

    subscription.chatId = chatId;
    return { result: { status: "linked", subscription }, changed: true };
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
    if (index === -1) return { result: false, changed: false };

    store.subscriptions.splice(index, 1);
    return { result: true, changed: true };
  });
}

export async function markNotified(
  ids: string[],
  when: string,
): Promise<void> {
  if (ids.length === 0) return;

  const idSet = new Set(ids);
  await mutate((store) => {
    let changed = false;
    for (const subscription of store.subscriptions) {
      if (idSet.has(subscription.id)) {
        subscription.lastNotifiedAt = when;
        changed = true;
      }
    }
    return { result: undefined, changed };
  });
}

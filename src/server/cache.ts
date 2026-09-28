import "server-only";
import { db } from "./db";

/**
 * Tiny in-process cache for expensive analytics reads. Entries are keyed by a
 * workspace "data version" (latest sync + account count), so any collection or
 * structural change invalidates them automatically — no stale numbers.
 */
const store = new Map<string, { at: number; value: unknown }>();
const TTL = 5 * 60_000;
const MAX = 300;

export async function workspaceVersion(workspaceId: string) {
  const r = await db.socialAccount.aggregate({
    where: { workspaceId },
    _max: { lastSyncedAt: true, updatedAt: true },
    _count: { _all: true },
  });
  return `${r._count._all}:${r._max.lastSyncedAt?.getTime() ?? 0}:${r._max.updatedAt?.getTime() ?? 0}`;
}

export async function cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await compute();
  if (store.size >= MAX) store.delete(store.keys().next().value!);
  store.set(key, { at: Date.now(), value });
  return value;
}

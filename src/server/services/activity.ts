import "server-only";
import { db } from "@/server/db";
import type { ActivityItem } from "@/lib/types";
import type { Viewer } from "@/server/auth/session";
import { accountRef, mediaUrl } from "./shared";

export async function listActivity(viewer: Viewer, opts: { limit?: number; cursor?: string } = {}) {
  const limit = Math.min(opts.limit ?? 20, 50);
  const events = await db.activityEvent.findMany({
    where: { workspaceId: viewer.workspace.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    include: {
      account: { select: { id: true, platform: true, username: true, displayName: true, avatarAssetId: true } },
      post: { select: { id: true, thumbnailAssetId: true, caption: true } },
    },
  });
  const items: ActivityItem[] = events.slice(0, limit).map((e) => ({
    id: e.id,
    type: e.type,
    createdAt: e.createdAt.toISOString(),
    account: e.account ? accountRef(e.account) : null,
    post: e.post ? { id: e.post.id, thumbnailUrl: mediaUrl(e.post.thumbnailAssetId), caption: e.post.caption } : null,
    payload: (e.payload as Record<string, unknown> | null) ?? null,
  }));
  return { items, nextCursor: events.length > limit ? events[limit - 1].id : null };
}

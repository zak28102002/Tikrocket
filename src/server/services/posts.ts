import "server-only";
import { z } from "zod";
import { db, Prisma } from "@/server/db";
import { addDays, dayKey, diffDays, startOfDayUtc } from "@/lib/dates";
import type { PostDetailResponse } from "@/lib/types";
import type { Viewer } from "@/server/auth/session";
import { notFound } from "@/server/errors";
import { engagementRate } from "@/server/analytics/series";
import { n, postCard, postInclude } from "./shared";

export const PostQuery = z.object({
  appId: z.string().optional(),
  platform: z.enum(["TIKTOK", "INSTAGRAM", "YOUTUBE"]).optional(),
  accountId: z.string().optional(),
  published: z.enum(["7d", "30d", "90d", "1y", "all"]).default("all"),
  performance: z.enum(["all", "top10", "above_avg"]).default("all"),
  sort: z.enum(["views", "likes", "comments", "shares", "newest"]).default("views"),
  q: z.string().trim().max(100).optional(),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

const PUBLISHED_DAYS = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 } as const;

export async function listPosts(viewer: Viewer, q: z.infer<typeof PostQuery>) {
  const where: Prisma.PostWhereInput = {
    workspaceId: viewer.workspace.id,
    ...(q.appId ? { appId: q.appId } : {}),
    ...(q.platform ? { platform: q.platform } : {}),
    ...(q.accountId ? { accountId: q.accountId } : {}),
    ...(q.q ? { caption: { contains: q.q, mode: "insensitive" as const } } : {}),
  };
  if (q.published !== "all") {
    const today = dayKey(new Date(), viewer.workspace.timezone);
    where.publishedAt = { gte: startOfDayUtc(addDays(today, -(PUBLISHED_DAYS[q.published] - 1)), viewer.workspace.timezone) };
  }
  if (q.performance !== "all") {
    const [row] = await db.$queryRaw<{ threshold: number | null }[]>`
      SELECT ${q.performance === "top10" ? Prisma.sql`percentile_cont(0.9) WITHIN GROUP (ORDER BY views)` : Prisma.sql`avg(views)`}::float8 AS threshold
      FROM "Post" WHERE "workspaceId" = ${viewer.workspace.id} AND views IS NOT NULL`;
    if (row?.threshold !== null && row?.threshold !== undefined) where.views = { gte: BigInt(Math.ceil(row.threshold)) };
  }

  const orderBy: Prisma.PostOrderByWithRelationInput[] =
    q.sort === "newest"
      ? [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }]
      : [{ [q.sort]: { sort: "desc", nulls: "last" } }, { id: "desc" }];

  const [posts, total] = await Promise.all([
    db.post.findMany({ where, include: postInclude, orderBy, skip: q.cursor, take: q.limit + 1 }),
    db.post.count({ where }),
  ]);
  return {
    posts: posts.slice(0, q.limit).map((p) => postCard(p)),
    total,
    nextCursor: posts.length > q.limit ? q.cursor + q.limit : null,
  };
}

export async function getPostDetail(viewer: Viewer, id: string): Promise<PostDetailResponse> {
  const post = await db.post.findFirst({ where: { id, workspaceId: viewer.workspace.id }, include: postInclude });
  if (!post) throw notFound("Post");
  const tz = viewer.workspace.timezone;
  const snaps = await db.postMetricSnapshot.findMany({
    where: { postId: id },
    orderBy: { capturedAt: "asc" },
    select: { capturedAt: true, views: true, likes: true },
  });

  // Last observation per local day.
  const perDay = new Map<string, { views: number | null; likes: number | null }>();
  for (const s of snaps) perDay.set(dayKey(s.capturedAt, tz), { views: n(s.views), likes: n(s.likes) });

  const publishDay = post.publishedAt ? dayKey(post.publishedAt, tz) : (snaps[0] ? dayKey(snaps[0].capturedAt, tz) : null);
  const today = dayKey(new Date(), tz);
  const timeline: PostDetailResponse["timeline"] = [];
  let trackingStartedDay: number | null = null;
  if (publishDay) {
    const span = Math.min(diffDays(today, publishDay) + 1, 120);
    let lastViews: number | null = null;
    let lastLikes: number | null = null;
    let prevViews: number | null = null;
    for (let i = 0; i < span; i++) {
      const date = addDays(publishDay, i);
      const obs = perDay.get(date);
      if (obs) {
        if (trackingStartedDay === null) trackingStartedDay = i + 1;
        if (obs.views !== null) lastViews = obs.views;
        if (obs.likes !== null) lastLikes = obs.likes;
      }
      // Before tracking began the value is unknown, not zero — except day 0 of a post
      // we saw being published (its baseline is genuinely 0).
      const views = trackingStartedDay === null ? null : lastViews;
      timeline.push({
        day: i + 1,
        date,
        views,
        likes: trackingStartedDay === null ? null : lastLikes,
        gained: views !== null && prevViews !== null ? views - prevViews : i === 0 && views !== null ? views : null,
      });
      prevViews = views;
    }
  }

  const card = postCard(post);
  return {
    post: {
      ...card,
      durationSec: post.durationSec,
      firstSeenAt: post.firstSeenAt.toISOString(),
      lastSyncedAt: post.lastSyncedAt?.toISOString() ?? null,
    },
    engagementRate: engagementRate(card),
    timeline,
    trackingStartedDay,
  };
}

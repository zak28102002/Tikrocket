import "server-only";
import { db, Prisma } from "@/server/db";
import { addDays, dayKey, startOfDayUtc, utcToKey, type DayKey } from "@/lib/dates";
import { resolveRange, type RangeInput, type ResolvedRange } from "@/lib/range";
import type { PlatformKey } from "@/lib/profile-url";
import type { AccountRef, AccountRow, AppRef, PostCard } from "@/lib/types";
import { byAccount, chartSeries, periodSummary, type DailyRow, type Metric } from "@/server/analytics/series";
import type { Viewer } from "@/server/auth/session";

export const n = (b: bigint | number | null | undefined) => (b === null || b === undefined ? null : Number(b));
export const mediaUrl = (assetId: string | null | undefined) => (assetId ? `/api/media/${assetId}` : null);
export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function appRef(a: { id: string; name: string; iconAssetId: string | null; iconSeed: number }): AppRef {
  return { id: a.id, name: a.name, iconUrl: mediaUrl(a.iconAssetId), iconSeed: a.iconSeed };
}

export function accountRef(a: {
  id: string;
  platform: string;
  username: string;
  displayName: string | null;
  avatarAssetId: string | null;
}): AccountRef {
  return {
    id: a.id,
    platform: a.platform as PlatformKey,
    username: a.username,
    displayName: a.displayName,
    avatarUrl: mediaUrl(a.avatarAssetId),
  };
}

/** Accounts in scope + their daily rows covering [prevFrom-1 .. to] and a seed row before. */
export type Scope = { workspaceId: string; appId?: string; accountId?: string; platform?: PlatformKey };

export async function loadScope(viewer: Viewer, scope: Omit<Scope, "workspaceId">, input: RangeInput) {
  const tz = viewer.workspace.timezone;
  const accounts = await db.socialAccount.findMany({
    where: {
      workspaceId: viewer.workspace.id,
      ...(scope.appId ? { appId: scope.appId } : {}),
      ...(scope.accountId ? { id: scope.accountId } : {}),
      ...(scope.platform ? { platform: scope.platform } : {}),
    },
    include: { app: { select: { id: true, name: true, iconAssetId: true, iconSeed: true } } },
    orderBy: { createdAt: "asc" },
  });
  const ids = accounts.map((a) => a.id);
  const today = dayKey(new Date(), tz);

  let earliest: DayKey | null = null;
  if (ids.length && input.range === "all") {
    const r = await db.accountDailyMetric.aggregate({ where: { accountId: { in: ids } }, _min: { date: true } });
    earliest = r._min.date ? utcToKey(r._min.date) : null;
  }
  const range = resolveRange(input, today, earliest);
  const start = addDays(range.prevFrom ?? range.from, -1);
  const rows = ids.length ? await dailyRows(ids, start, range.to) : [];
  return { accounts, range, rows, byAccount: byAccount(rows), today };
}

export async function dailyRows(accountIds: string[], start: DayKey, to: DayKey): Promise<DailyRow[]> {
  type Raw = { accountId: string; date: string } & Record<Metric, bigint | null>;
  const raw = await db.$queryRaw<Raw[]>`
    (SELECT "accountId", to_char(date, 'YYYY-MM-DD') AS date, followers, views, likes, posts, comments, shares
       FROM "AccountDailyMetric"
      WHERE "accountId" = ANY(${accountIds}) AND date >= ${start}::date AND date <= ${to}::date)
    UNION ALL
    (SELECT DISTINCT ON ("accountId") "accountId", to_char(date, 'YYYY-MM-DD') AS date, followers, views, likes, posts, comments, shares
       FROM "AccountDailyMetric"
      WHERE "accountId" = ANY(${accountIds}) AND date < ${start}::date
      ORDER BY "accountId", date DESC)`;
  return raw.map((r) => ({
    accountId: r.accountId,
    date: r.date,
    views: n(r.views),
    likes: n(r.likes),
    followers: n(r.followers),
    posts: n(r.posts),
    comments: n(r.comments),
    shares: n(r.shares),
  }));
}

export function subset(all: Map<string, DailyRow[]>, ids: string[]) {
  const m = new Map<string, DailyRow[]>();
  for (const id of ids) {
    const r = all.get(id);
    if (r) m.set(id, r);
  }
  return m;
}

export function kpis(rows: Map<string, DailyRow[]>, range: ResolvedRange) {
  return {
    views: periodSummary(rows, range, "views"),
    likes: periodSummary(rows, range, "likes"),
    posts: periodSummary(rows, range, "posts"),
    followers: periodSummary(rows, range, "followers"),
  };
}

export function charts(rows: Map<string, DailyRow[]>, range: ResolvedRange) {
  return {
    views: chartSeries(rows, range, "views"),
    likes: chartSeries(rows, range, "likes"),
    followers: chartSeries(rows, range, "followers"),
    posts: chartSeries(rows, range, "posts"),
  };
}

/** Compact sparkline: daily view gains, down-sampled to ≤ 30 points. */
export function spark(rows: Map<string, DailyRow[]>, range: ResolvedRange): (number | null)[] {
  const pts = chartSeries(rows, range, "views").map((p) => p.value);
  if (pts.length <= 30) return pts;
  const size = Math.ceil(pts.length / 30);
  const out: (number | null)[] = [];
  for (let i = 0; i < pts.length; i += size) {
    const chunk = pts.slice(i, i + size).filter((v): v is number => v !== null);
    out.push(chunk.length ? chunk.reduce((a, b) => a + b, 0) : null);
  }
  return out;
}

type AccountWithApp = Awaited<ReturnType<typeof loadScope>>["accounts"][number];

export async function activeJobs(accountIds: string[]) {
  if (!accountIds.length) return new Map<string, string>();
  const jobs = await db.refreshJob.findMany({
    where: { accountId: { in: accountIds }, status: { in: ["QUEUED", "RUNNING"] } },
    select: { id: true, accountId: true },
  });
  return new Map(jobs.map((j) => [j.accountId, j.id]));
}

export function accountRow(
  a: AccountWithApp,
  rows: Map<string, DailyRow[]>,
  range: ResolvedRange,
  jobs: Map<string, string>,
): AccountRow {
  const mine = subset(rows, [a.id]);
  const views = periodSummary(mine, range, "views");
  const followers = periodSummary(mine, range, "followers");
  return {
    ...accountRef(a),
    app: appRef(a.app),
    profileUrl: a.profileUrl,
    status: a.status,
    userError: a.userError,
    lastSyncedAt: iso(a.lastSyncedAt),
    followers: n(a.followers),
    totalViews: n(a.totalViews),
    totalLikes: n(a.totalLikes),
    postCount: n(a.postCount),
    viewsSource: a.viewsSource,
    period: { views: views.value, viewsPct: views.changePct, followers: followers.change },
    spark: spark(mine, range),
    refreshMinutes: a.refreshMinutes,
    activeJobId: jobs.get(a.id) ?? null,
  };
}

// ─── Content ──────────────────────────────────────────────────────────────

export const postInclude = {
  account: { select: { id: true, platform: true, username: true, displayName: true, avatarAssetId: true } },
  app: { select: { id: true, name: true, iconAssetId: true, iconSeed: true } },
} as const;

type PostWithRefs = Prisma.PostGetPayload<{ include: typeof postInclude }>;

export function postCard(p: PostWithRefs, periodViews?: number | null): PostCard {
  const remoteThumb = p.thumbnailUrl && p.thumbnailUrl.startsWith("https://") ? p.thumbnailUrl : null;
  return {
    id: p.id,
    platform: p.platform as PlatformKey,
    url: p.url,
    thumbnailUrl: mediaUrl(p.thumbnailAssetId) ?? remoteThumb,
    caption: p.caption,
    publishedAt: iso(p.publishedAt),
    views: n(p.views),
    likes: n(p.likes),
    comments: n(p.comments),
    shares: n(p.shares),
    ...(periodViews !== undefined ? { periodViews } : {}),
    account: accountRef(p.account),
    app: appRef(p.app),
  };
}

/**
 * Top content by views gained within the period, from post snapshots:
 * end-of-period views minus the last value before the period (or 0 for posts
 * published inside it, or the first in-period observation if tracking began later).
 */
export async function topContent(viewer: Viewer, scope: Omit<Scope, "workspaceId">, range: ResolvedRange, limit = 12) {
  const where: Prisma.PostWhereInput = {
    workspaceId: viewer.workspace.id,
    ...(scope.appId ? { appId: scope.appId } : {}),
    ...(scope.accountId ? { accountId: scope.accountId } : {}),
    ...(scope.platform ? { platform: scope.platform } : {}),
  };

  if (range.key === "all") {
    const posts = await db.post.findMany({
      where: { ...where, views: { not: null } },
      include: postInclude,
      orderBy: { views: "desc" },
      take: limit,
    });
    return posts.map((p) => postCard(p, n(p.views)));
  }

  const fromTs = startOfDayUtc(range.from, viewer.workspace.timezone);
  const toTs = startOfDayUtc(addDays(range.to, 1), viewer.workspace.timezone);
  const filters = [
    Prisma.sql`p."workspaceId" = ${viewer.workspace.id}`,
    scope.appId ? Prisma.sql`p."appId" = ${scope.appId}` : null,
    scope.accountId ? Prisma.sql`p."accountId" = ${scope.accountId}` : null,
    scope.platform ? Prisma.sql`p.platform = ${scope.platform}::"Platform"` : null,
  ].filter(Boolean) as Prisma.Sql[];

  const ranked = await db.$queryRaw<{ id: string; gained: bigint | null }[]>`
    WITH scope AS (
      SELECT p.id, p."publishedAt" FROM "Post" p WHERE ${Prisma.join(filters, " AND ")}
    ),
    e AS (
      SELECT DISTINCT ON (s."postId") s."postId", s.views FROM "PostMetricSnapshot" s
      JOIN scope ON scope.id = s."postId"
      WHERE s."capturedAt" < ${toTs} AND s.views IS NOT NULL
      ORDER BY s."postId", s."capturedAt" DESC
    ),
    b AS (
      SELECT DISTINCT ON (s."postId") s."postId", s.views FROM "PostMetricSnapshot" s
      JOIN e ON e."postId" = s."postId"
      WHERE s."capturedAt" < ${fromTs} AND s.views IS NOT NULL
      ORDER BY s."postId", s."capturedAt" DESC
    ),
    f AS (
      SELECT DISTINCT ON (s."postId") s."postId", s.views FROM "PostMetricSnapshot" s
      JOIN e ON e."postId" = s."postId"
      WHERE s."capturedAt" >= ${fromTs} AND s."capturedAt" < ${toTs} AND s.views IS NOT NULL
      ORDER BY s."postId", s."capturedAt" ASC
    )
    SELECT e."postId" AS id,
      e.views - COALESCE(b.views, CASE WHEN scope."publishedAt" >= ${fromTs} THEN 0 ELSE f.views END) AS gained
    FROM e
    JOIN scope ON scope.id = e."postId"
    LEFT JOIN b ON b."postId" = e."postId"
    LEFT JOIN f ON f."postId" = e."postId"
    ORDER BY gained DESC NULLS LAST
    LIMIT ${limit}`;

  const gained = new Map(ranked.filter((r) => r.gained !== null && r.gained > 0n).map((r) => [r.id, Number(r.gained)]));
  if (!gained.size) return [];
  const posts = await db.post.findMany({ where: { id: { in: [...gained.keys()] } }, include: postInclude });
  return posts
    .map((p) => postCard(p, gained.get(p.id) ?? null))
    .sort((a, b) => (b.periodViews ?? 0) - (a.periodViews ?? 0));
}

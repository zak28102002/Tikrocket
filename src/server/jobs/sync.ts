import { db } from "@/server/db";
import { dayKey, keyToUtc } from "@/lib/dates";
import { parseProfileUrl, type PlatformKey } from "@/lib/profile-url";
import { connectorFor } from "@/server/connectors/registry";
import { asConnectorError, ConnectorError } from "@/server/connectors/errors";
import type { AccountRef, NormalizedPost, NormalizedPostMetrics } from "@/server/connectors/types";
import { ingestRemoteImage } from "@/server/media";
import type { JobStage } from "@/generated/prisma/enums";

const big = (n: number | null | undefined) => (n === null || n === undefined ? null : BigInt(n));
const num = (b: bigint | null) => (b === null ? null : Number(b));
const INITIAL_POST_LIMIT = 100;
const POST_LIMIT = 50;
/** Posts outside the fetched window but younger than this still get fresh metrics. */
const ACTIVE_POST_DAYS = 45;

async function setStage(jobId: string, stage: JobStage) {
  await db.refreshJob.update({ where: { id: jobId }, data: { stage } });
}

/** Execute one claimed RefreshJob end-to-end. Never throws. */
export async function runSyncJob(jobId: string) {
  const job = await db.refreshJob.findUnique({
    where: { id: jobId },
    include: { account: { include: { workspace: true } } },
  });
  if (!job) return;
  const account = job.account;
  const workspace = account.workspace;
  const platform = account.platform as PlatformKey;
  const connector = connectorFor(platform, workspace);
  const isInitial = job.trigger === "INITIAL" || account.lastSyncedAt === null;
  const interval = account.refreshMinutes ?? workspace.defaultRefreshMinutes;
  const nextRefreshAt = interval > 0 ? new Date(Date.now() + interval * 60_000) : null;

  try {
    await db.socialAccount.update({ where: { id: account.id }, data: { status: "SYNCING", connectorId: connector.id } });

    if (!connector.isConfigured()) {
      throw new ConnectorError("NOT_CONFIGURED", platform, `${connector.id} not configured`, false);
    }

    const parsed = parseProfileUrl(account.profileUrl);
    if (!parsed.ok) throw new ConnectorError("NOT_FOUND", platform, `stored URL no longer parses: ${parsed.reason}`, false);
    let ref: AccountRef = { ...parsed.profile, platformAccountId: account.platformAccountId };

    // 1 · Profile
    await setStage(jobId, "CHECKING_PROFILE");
    const profile = await connector.getProfile(ref);
    ref = profile.ref;

    // 2 · Content
    await setStage(jobId, "FINDING_CONTENT");
    const fetched = await connector.getPosts(ref, { limit: isInitial ? INITIAL_POST_LIMIT : POST_LIMIT });

    // 3 · Metrics
    await setStage(jobId, "COLLECTING_METRICS");
    const metrics = await connector.getProfileMetrics(ref);
    const fetchedIds = new Set(fetched.map((p) => p.platformPostId));
    const activeCutoff = new Date(Date.now() - ACTIVE_POST_DAYS * 86_400_000);
    const staleActive = await db.post.findMany({
      where: { accountId: account.id, publishedAt: { gte: activeCutoff }, platformPostId: { notIn: [...fetchedIds] } },
      select: { platformPostId: true },
      take: 200,
    });
    let extra: NormalizedPostMetrics[] = [];
    if (staleActive.length) {
      extra = await connector
        .getPostMetrics(ref, staleActive.map((p) => p.platformPostId))
        .catch(() => [] as NormalizedPostMetrics[]); // best effort; the main sync already succeeded
    }

    // 4 · Persist
    await setStage(jobId, "FINALIZING");
    const now = new Date();
    const avatarAssetId =
      profile.avatarUrl && (!account.avatarAssetId || isInitial)
        ? ((await ingestRemoteImage(profile.avatarUrl, "avatar")) ?? account.avatarAssetId)
        : account.avatarAssetId;

    const result = await persist({
      accountId: account.id,
      workspaceId: account.workspaceId,
      appId: account.appId,
      platform,
      timezone: workspace.timezone,
      fetched,
      extra,
      metrics,
      now,
      jobId,
    });

    const prevViews = num(account.totalViews);
    await db.socialAccount.update({
      where: { id: account.id },
      data: {
        platformAccountId: profile.platformAccountId,
        displayName: profile.displayName,
        bio: profile.bio,
        isVerified: profile.isVerified,
        avatarAssetId,
        followers: big(metrics.followers),
        following: big(metrics.following),
        totalLikes: result.likes,
        totalViews: result.views,
        postCount: big(metrics.postCount) ?? BigInt(result.postTotal),
        viewsSource: result.viewsSource,
        status: "HEALTHY",
        userError: null,
        devErrorDetail: null,
        lastSyncedAt: now,
        nextRefreshAt,
        trackingSince: account.trackingSince ?? now,
      },
    });

    // Activity
    const viewsGained = prevViews !== null && result.views !== null ? Number(result.views) - prevViews : null;
    if (isInitial) {
      await db.activityEvent.create({
        data: {
          workspaceId: account.workspaceId,
          accountId: account.id,
          type: "ACCOUNT_ADDED",
          payload: { posts: fetched.length },
        },
      });
    } else {
      if (result.newPostIds.length) {
        await db.activityEvent.createMany({
          data: result.newPostIds.slice(0, 10).map((postId) => ({
            workspaceId: account.workspaceId,
            accountId: account.id,
            postId,
            type: "POST_DETECTED" as const,
          })),
        });
      }
      // Small drifts are noise in an activity feed; only surface meaningful jumps.
      if (viewsGained !== null && viewsGained >= 1000) {
        await db.activityEvent.create({
          data: {
            workspaceId: account.workspaceId,
            accountId: account.id,
            type: viewsGained >= 100_000 ? "VIEWS_MILESTONE" : "ACCOUNT_UPDATED",
            payload: { viewsGained },
          },
        });
      }
    }

    await db.refreshJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCEEDED",
        stage: "DONE",
        finishedAt: new Date(),
        postsFound: fetched.length,
        newPosts: result.newPostIds.length,
        lockedAt: null,
      },
    });

    // Thumbnails last: they're nice-to-have and must not hold the job open.
    await ingestThumbnails(account.id);
  } catch (raw) {
    const err = asConnectorError(raw, platform);
    console.warn(`[sync] ${account.platform} @${account.username} job=${jobId}: ${err.message}`);
    const canRetry = err.retryable && job.attempts < job.maxAttempts;
    if (canRetry) {
      const backoffMs = Math.min(15 * 60_000, 30_000 * 2 ** (job.attempts - 1));
      await db.refreshJob.update({
        where: { id: jobId },
        data: {
          status: "QUEUED",
          stage: "QUEUED",
          runAfter: new Date(Date.now() + backoffMs),
          lockedAt: null,
          lockedBy: null,
          devErrorDetail: err.detail.slice(0, 2000),
        },
      });
      await db.socialAccount.update({
        where: { id: account.id },
        // Keep the prior status while a retry is pending.
        data: { status: account.status === "SYNCING" ? "PENDING" : account.status },
      });
      return;
    }
    const unavailable = err.code === "NOT_CONFIGURED";
    await db.refreshJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        stage: "DONE",
        finishedAt: new Date(),
        lockedAt: null,
        userError: err.userMessage,
        devErrorDetail: `${err.code}: ${err.detail}`.slice(0, 2000),
      },
    });
    await db.socialAccount.update({
      where: { id: account.id },
      data: {
        status: unavailable ? "UNAVAILABLE" : "ERROR",
        userError: err.userMessage,
        devErrorDetail: `${err.code}: ${err.detail}`.slice(0, 2000),
        nextRefreshAt,
      },
    });
    if (!unavailable) {
      await db.activityEvent.create({
        data: {
          workspaceId: account.workspaceId,
          accountId: account.id,
          type: "SYNC_FAILED",
          payload: { message: err.userMessage },
        },
      });
    }
  }
}

type PersistInput = {
  accountId: string;
  workspaceId: string;
  appId: string;
  platform: PlatformKey;
  timezone: string;
  fetched: NormalizedPost[];
  extra: NormalizedPostMetrics[];
  metrics: { followers: number | null; following: number | null; totalLikes: number | null; totalViews: number | null; postCount: number | null };
  now: Date;
  jobId: string;
};

/** Write posts, append snapshots, recompute account totals and upsert the daily rollup. */
async function persist(input: PersistInput) {
  const { accountId, now } = input;
  return db.$transaction(
    async (tx) => {
      const existing = await tx.post.findMany({
        where: { accountId, platformPostId: { in: input.fetched.map((p) => p.platformPostId) } },
        select: { id: true, platformPostId: true },
      });
      const byPid = new Map(existing.map((p) => [p.platformPostId, p.id]));
      const newPostIds: string[] = [];

      for (const p of input.fetched) {
        const data = {
          url: p.url,
          thumbnailUrl: p.thumbnailUrl,
          caption: p.caption,
          publishedAt: p.publishedAt,
          durationSec: p.durationSec,
          views: big(p.views),
          likes: big(p.likes),
          comments: big(p.comments),
          shares: big(p.shares),
          lastSyncedAt: now,
        };
        let id = byPid.get(p.platformPostId);
        if (id) {
          await tx.post.update({ where: { id }, data });
        } else {
          const created = await tx.post.create({
            data: {
              ...data,
              accountId,
              appId: input.appId,
              workspaceId: input.workspaceId,
              platform: input.platform,
              platformPostId: p.platformPostId,
              firstSeenAt: now,
            },
            select: { id: true },
          });
          id = created.id;
          newPostIds.push(id);
          byPid.set(p.platformPostId, id);
        }
      }

      // Metrics-only refresh for recent posts outside the fetched window.
      if (input.extra.length) {
        const rows = await tx.post.findMany({
          where: { accountId, platformPostId: { in: input.extra.map((e) => e.platformPostId) } },
          select: { id: true, platformPostId: true },
        });
        const ids = new Map(rows.map((r) => [r.platformPostId, r.id]));
        for (const m of input.extra) {
          const id = ids.get(m.platformPostId);
          if (!id) continue;
          byPid.set(m.platformPostId, id);
          await tx.post.update({
            where: { id },
            data: { views: big(m.views), likes: big(m.likes), comments: big(m.comments), shares: big(m.shares), lastSyncedAt: now },
          });
        }
      }

      // Append-only post snapshots for everything we observed this run.
      const observed = [...input.fetched, ...input.extra];
      await tx.postMetricSnapshot.createMany({
        data: observed
          .filter((m) => byPid.has(m.platformPostId))
          .map((m) => ({
            postId: byPid.get(m.platformPostId)!,
            capturedAt: now,
            views: big(m.views),
            likes: big(m.likes),
            comments: big(m.comments),
            shares: big(m.shares),
          })),
      });

      // Account totals over all tracked posts (latest known values).
      const agg = await tx.post.aggregate({
        where: { accountId },
        _sum: { views: true, likes: true, comments: true, shares: true },
        _count: { _all: true, views: true, likes: true, comments: true, shares: true },
      });
      const postViews = agg._count.views > 0 ? (agg._sum.views ?? 0n) : null;
      const postLikes = agg._count.likes > 0 ? (agg._sum.likes ?? 0n) : null;
      const postComments = agg._count.comments > 0 ? (agg._sum.comments ?? 0n) : null;
      const postShares = agg._count.shares > 0 ? (agg._sum.shares ?? 0n) : null;

      const profileViews = big(input.metrics.totalViews);
      const views = profileViews ?? postViews;
      const viewsSource = profileViews !== null ? ("PROFILE" as const) : postViews !== null ? ("POSTS" as const) : null;
      const likes = big(input.metrics.totalLikes) ?? postLikes;
      const posts = big(input.metrics.postCount) ?? BigInt(agg._count._all);

      await tx.accountMetricSnapshot.create({
        data: {
          accountId,
          jobId: input.jobId,
          capturedAt: now,
          followers: big(input.metrics.followers),
          following: big(input.metrics.following),
          totalLikes: big(input.metrics.totalLikes),
          totalViews: profileViews,
          postCount: big(input.metrics.postCount),
          postViews,
          postLikes,
          views,
          viewsSource,
        },
      });

      const date = keyToUtc(dayKey(now, input.timezone));
      const rollup = {
        followers: big(input.metrics.followers),
        views,
        likes,
        posts,
        comments: postComments,
        shares: postShares,
      };
      await tx.accountDailyMetric.upsert({
        where: { accountId_date: { accountId, date } },
        create: { accountId, date, ...rollup },
        update: rollup,
      });

      return { views, likes, viewsSource, postTotal: agg._count._all, newPostIds };
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

async function ingestThumbnails(accountId: string) {
  const posts = await db.post.findMany({
    where: { accountId, thumbnailAssetId: null, thumbnailUrl: { not: null } },
    select: { id: true, thumbnailUrl: true },
    orderBy: { publishedAt: "desc" },
    take: 120,
  });
  const queue = [...posts];
  const workers = Array.from({ length: 4 }, async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      const assetId = await ingestRemoteImage(p.thumbnailUrl, "thumbnail");
      if (assetId) await db.post.update({ where: { id: p.id }, data: { thumbnailAssetId: assetId } });
    }
  });
  await Promise.all(workers);
}


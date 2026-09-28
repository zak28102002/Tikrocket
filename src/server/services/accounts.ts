import "server-only";
import { z } from "zod";
import { db, Prisma } from "@/server/db";
import { parseProfileUrl, type PlatformKey } from "@/lib/profile-url";
import type { RangeInput } from "@/lib/range";
import type { AccountDetailResponse, AccountRow, JobStatusResponse, ResolveResponse } from "@/lib/types";
import type { Viewer } from "@/server/auth/session";
import { badRequest, conflict, notFound } from "@/server/errors";
import { connectorFor } from "@/server/connectors/registry";
import { enqueueRefresh } from "@/server/jobs/queue";
import { engagementRate } from "@/server/analytics/series";
import { accountRow, activeJobs, charts, kpis, loadScope, n } from "./shared";

export const REFRESH_CHOICES = [60, 360, 720, 1440, 0] as const;

export async function resolveProfile(viewer: Viewer, url: string): Promise<ResolveResponse> {
  const parsed = parseProfileUrl(url);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };
  const { platform, username, canonicalUrl } = parsed.profile;
  const existing = await db.socialAccount.findUnique({
    where: { workspaceId_platform_username: { workspaceId: viewer.workspace.id, platform, username } },
    include: { app: { select: { name: true } } },
  });
  return {
    ok: true,
    platform,
    username,
    canonicalUrl,
    connectorConfigured: connectorFor(platform, viewer.workspace).isConfigured(),
    existing: existing ? { id: existing.id, appName: existing.app.name } : null,
  };
}

export const CreateAccountInput = z.object({
  appId: z.string().min(1),
  url: z.string().trim().min(1, "Paste a public profile URL.").max(500),
});

export async function createAccount(viewer: Viewer, input: z.infer<typeof CreateAccountInput>) {
  const app = await db.app.findFirst({ where: { id: input.appId, workspaceId: viewer.workspace.id } });
  if (!app) throw notFound("App");
  const parsed = parseProfileUrl(input.url);
  if (!parsed.ok) throw badRequest(parsed.reason);
  const { platform, username, canonicalUrl } = parsed.profile;

  try {
    const connector = connectorFor(platform, viewer.workspace);
    const account = await db.socialAccount.create({
      data: {
        workspaceId: viewer.workspace.id,
        appId: app.id,
        platform,
        username,
        profileUrl: canonicalUrl,
        connectorId: connector.id,
        status: "PENDING",
      },
    });
    const job = await enqueueRefresh(account.id, "INITIAL");
    return { accountId: account.id, jobId: job.id, connectorConfigured: connector.isConfigured() };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw conflict("This profile is already being tracked in this workspace.");
    }
    throw err;
  }
}

export const UpdateAccountInput = z.object({
  appId: z.string().optional(),
  refreshMinutes: z
    .union([z.literal(null), z.number().int()])
    .refine((v) => v === null || (REFRESH_CHOICES as readonly number[]).includes(v), "Choose a supported interval.")
    .optional(),
  paused: z.boolean().optional(),
});

export async function updateAccount(viewer: Viewer, id: string, input: z.infer<typeof UpdateAccountInput>) {
  const account = await db.socialAccount.findFirst({ where: { id, workspaceId: viewer.workspace.id }, include: { workspace: true } });
  if (!account) throw notFound("Account");
  if (input.appId) {
    const app = await db.app.findFirst({ where: { id: input.appId, workspaceId: viewer.workspace.id } });
    if (!app) throw notFound("App");
  }
  const minutes = input.refreshMinutes !== undefined ? input.refreshMinutes : account.refreshMinutes;
  const effective = minutes ?? account.workspace.defaultRefreshMinutes;
  await db.$transaction([
    db.socialAccount.update({
      where: { id },
      data: {
        ...(input.appId ? { appId: input.appId } : {}),
        ...(input.refreshMinutes !== undefined
          ? {
              refreshMinutes: input.refreshMinutes,
              nextRefreshAt: effective > 0 ? new Date((account.lastSyncedAt ?? new Date()).getTime() + effective * 60_000) : null,
            }
          : {}),
        ...(input.paused !== undefined ? { status: input.paused ? "PAUSED" : account.lastSyncedAt ? "HEALTHY" : "PENDING" } : {}),
      },
    }),
    ...(input.appId ? [db.post.updateMany({ where: { accountId: id }, data: { appId: input.appId } })] : []),
  ]);
}

export async function deleteAccount(viewer: Viewer, id: string) {
  const res = await db.socialAccount.deleteMany({ where: { id, workspaceId: viewer.workspace.id } });
  if (!res.count) throw notFound("Account");
}

export async function refreshAccount(viewer: Viewer, id: string) {
  const account = await db.socialAccount.findFirst({ where: { id, workspaceId: viewer.workspace.id } });
  if (!account) throw notFound("Account");
  const job = await enqueueRefresh(account.id, account.lastSyncedAt ? "MANUAL" : "INITIAL");
  return { jobId: job.id };
}

export async function getJob(viewer: Viewer, id: string): Promise<JobStatusResponse> {
  const job = await db.refreshJob.findFirst({
    where: { id, account: { workspaceId: viewer.workspace.id } },
    include: { account: { select: { status: true } } },
  });
  if (!job) throw notFound("Update");
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    postsFound: job.postsFound,
    userError: job.userError,
    accountId: job.accountId,
    accountStatus: job.account.status,
  };
}

export async function listAccounts(
  viewer: Viewer,
  input: RangeInput,
  filters: { appId?: string; platform?: PlatformKey },
): Promise<{ accounts: AccountRow[] }> {
  const { accounts, range, byAccount } = await loadScope(viewer, filters, input);
  const jobs = await activeJobs(accounts.map((a) => a.id));
  const rows = accounts.map((a) => accountRow(a, byAccount, range, jobs));
  rows.sort((a, b) => (b.period.views ?? -1) - (a.period.views ?? -1));
  return { accounts: rows };
}

export async function getAccountDetail(viewer: Viewer, id: string, input: RangeInput): Promise<AccountDetailResponse> {
  const { accounts, range, byAccount } = await loadScope(viewer, { accountId: id }, input);
  const a = accounts[0];
  if (!a) throw notFound("Account");
  const jobs = await activeJobs([a.id]);
  const connector = connectorFor(a.platform as PlatformKey, viewer.workspace);
  const agg = await db.post.aggregate({
    where: { accountId: a.id },
    _sum: { views: true, likes: true, comments: true, shares: true },
    _count: { _all: true, views: true, likes: true, comments: true, shares: true },
  });
  const sums = {
    views: agg._count.views ? n(agg._sum.views) : null,
    likes: agg._count.likes ? n(agg._sum.likes) : null,
    comments: agg._count.comments ? n(agg._sum.comments) : null,
    shares: agg._count.shares ? n(agg._sum.shares) : null,
  };

  return {
    range,
    account: {
      ...accountRow(a, byAccount, range, jobs),
      bio: a.bio,
      isVerified: a.isVerified,
      following: n(a.following),
      trackingSince: a.trackingSince?.toISOString() ?? null,
      nextRefreshAt: a.nextRefreshAt?.toISOString() ?? null,
      connector: {
        id: connector.id,
        label: connector.label,
        configured: connector.isConfigured(),
        capabilities: connector.capabilities,
      },
      devErrorDetail: viewer.role === "ADMIN" ? a.devErrorDetail : null,
    },
    kpis: kpis(byAccount, range),
    charts: charts(byAccount, range),
    engagementRate: engagementRate(sums),
    avgViewsPerPost: sums.views !== null && agg._count.views > 0 ? sums.views / agg._count.views : null,
  };
}

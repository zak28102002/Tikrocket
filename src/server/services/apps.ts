import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import type { RangeInput } from "@/lib/range";
import type { AppDetailResponse, AppSummary } from "@/lib/types";
import type { Viewer } from "@/server/auth/session";
import { notFound } from "@/server/errors";
import { periodSummary } from "@/server/analytics/series";
import { accountRow, activeJobs, appRef, charts, kpis, loadScope, spark, subset, topContent } from "./shared";
import { PLATFORMS } from "@/lib/platforms";

export const AppInput = z.object({
  name: z.string().trim().min(1, "Give your app a name.").max(60, "Keep the name under 60 characters."),
  description: z.string().trim().max(280, "Keep the description under 280 characters.").optional().nullable(),
  iconAssetId: z.string().max(40).optional().nullable(),
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "app";

async function uniqueSlug(workspaceId: string, name: string, excludeId?: string) {
  const base = slugify(name);
  for (let i = 1; i < 100; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const clash = await db.app.findFirst({ where: { workspaceId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) } });
    if (!clash) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function assertAsset(id: string | null | undefined) {
  if (!id) return null;
  const a = await db.mediaAsset.findUnique({ where: { id }, select: { id: true } });
  return a?.id ?? null;
}

export async function createApp(viewer: Viewer, input: z.infer<typeof AppInput>) {
  const app = await db.app.create({
    data: {
      workspaceId: viewer.workspace.id,
      name: input.name,
      description: input.description || null,
      slug: await uniqueSlug(viewer.workspace.id, input.name),
      iconAssetId: await assertAsset(input.iconAssetId),
      iconSeed: Math.floor(Math.random() * 12),
    },
  });
  return appRef(app);
}

export async function updateApp(viewer: Viewer, id: string, input: Partial<z.infer<typeof AppInput>>) {
  const app = await db.app.findFirst({ where: { id, workspaceId: viewer.workspace.id } });
  if (!app) throw notFound("App");
  const updated = await db.app.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name, slug: await uniqueSlug(viewer.workspace.id, input.name, id) } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.iconAssetId !== undefined ? { iconAssetId: await assertAsset(input.iconAssetId) } : {}),
    },
  });
  return appRef(updated);
}

export async function deleteApp(viewer: Viewer, id: string) {
  const res = await db.app.deleteMany({ where: { id, workspaceId: viewer.workspace.id } });
  if (!res.count) throw notFound("App");
}

export async function listApps(viewer: Viewer, input: RangeInput): Promise<{ apps: AppSummary[] }> {
  const [{ accounts, range, byAccount }, apps] = await Promise.all([
    loadScope(viewer, {}, input),
    db.app.findMany({ where: { workspaceId: viewer.workspace.id }, orderBy: { createdAt: "asc" } }),
  ]);
  return {
    apps: apps.map((app) => {
      const ids = accounts.filter((a) => a.appId === app.id).map((a) => a.id);
      const rows = subset(byAccount, ids);
      return {
        ...appRef(app),
        description: app.description,
        accountCount: ids.length,
        views: periodSummary(rows, range, "views"),
        likes: periodSummary(rows, range, "likes"),
        posts: periodSummary(rows, range, "posts"),
        followers: periodSummary(rows, range, "followers"),
        spark: spark(rows, range),
      };
    }),
  };
}

export async function getAppDetail(viewer: Viewer, id: string, input: RangeInput): Promise<AppDetailResponse> {
  const app = await db.app.findFirst({ where: { id, workspaceId: viewer.workspace.id } });
  if (!app) throw notFound("App");
  const { accounts, range, byAccount } = await loadScope(viewer, { appId: id }, input);
  const jobs = await activeJobs(accounts.map((a) => a.id));

  const platforms = PLATFORMS.map((platform) => {
    const ids = accounts.filter((a) => a.platform === platform).map((a) => a.id);
    const rows = subset(byAccount, ids);
    return {
      platform,
      accounts: ids.length,
      views: ids.length ? periodSummary(rows, range, "views").value : null,
      followers: ids.length ? periodSummary(rows, range, "followers").value : null,
    };
  }).filter((p) => p.accounts > 0);

  return {
    range,
    app: { ...appRef(app), description: app.description, createdAt: app.createdAt.toISOString() },
    kpis: kpis(byAccount, range),
    charts: charts(byAccount, range),
    platforms,
    accounts: accounts.map((a) => accountRow(a, byAccount, range, jobs)),
    topContent: accounts.length ? await topContent(viewer, { appId: id }, range, 10) : [],
  };
}

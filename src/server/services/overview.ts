import "server-only";
import { db } from "@/server/db";
import type { RangeInput } from "@/lib/range";
import type { OverviewResponse } from "@/lib/types";
import type { Viewer } from "@/server/auth/session";
import { periodSummary } from "@/server/analytics/series";
import { chartSeries } from "@/server/analytics/series";
import { listActivity } from "./activity";
import { accountRow, activeJobs, appRef, kpis, loadScope, spark, subset, topContent } from "./shared";

export async function getOverview(viewer: Viewer, input: RangeInput): Promise<OverviewResponse> {
  const [{ accounts, range, byAccount }, apps] = await Promise.all([
    loadScope(viewer, {}, input),
    db.app.findMany({ where: { workspaceId: viewer.workspace.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const jobs = await activeJobs(accounts.map((a) => a.id));

  const appSummaries = apps.map((app) => {
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
  });
  appSummaries.sort((a, b) => (b.views.value ?? -1) - (a.views.value ?? -1));

  const rows = accounts.map((a) => accountRow(a, byAccount, range, jobs));
  const topAccounts = rows
    .filter((r) => r.period.views !== null)
    .sort((a, b) => (b.period.views ?? 0) - (a.period.views ?? 0))
    .slice(0, 5)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const [content, activity] = await Promise.all([
    accounts.length ? topContent(viewer, {}, range, 12) : Promise.resolve([]),
    listActivity(viewer, { limit: 8 }),
  ]);

  return {
    range,
    kpis: kpis(byAccount, range),
    chart: chartSeries(byAccount, range, "views"),
    apps: appSummaries,
    topAccounts,
    topContent: content,
    activity: activity.items,
    counts: {
      apps: apps.length,
      accounts: accounts.length,
      healthy: accounts.filter((a) => a.status === "HEALTHY").length,
      unavailable: accounts.filter((a) => a.status === "UNAVAILABLE").length,
      syncing: accounts.filter((a) => a.status === "SYNCING" || a.status === "PENDING").length,
    },
  };
}

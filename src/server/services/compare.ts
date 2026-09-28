import "server-only";
import { db } from "@/server/db";
import type { RangeInput } from "@/lib/range";
import type { CompareResponse, MetricKey } from "@/lib/types";
import type { Viewer } from "@/server/auth/session";
import { bucketize, chartSeries, METRIC_KIND, periodSummary } from "@/server/analytics/series";
import { appRef, loadScope, subset } from "./shared";

export async function compareApps(viewer: Viewer, input: RangeInput, metric: MetricKey): Promise<CompareResponse> {
  const [{ accounts, range, byAccount }, apps] = await Promise.all([
    loadScope(viewer, {}, input),
    db.app.findMany({ where: { workspaceId: viewer.workspace.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const rows = apps.map((app) => {
    const scoped = subset(byAccount, accounts.filter((a) => a.appId === app.id).map((a) => a.id));
    return {
      ...appRef(app),
      summary: periodSummary(scoped, range, metric),
      series: bucketize(chartSeries(scoped, range, metric), 120, METRIC_KIND[metric]),
    };
  });
  rows.sort((a, b) => (b.summary.value ?? -1) - (a.summary.value ?? -1));
  return { range, metric, apps: rows };
}

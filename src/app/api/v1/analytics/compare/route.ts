import { route } from "@/server/http";
import { rangeFrom, str } from "@/server/params";
import { compareApps } from "@/server/services/compare";
import type { MetricKey } from "@/lib/types";

const METRICS = new Set(["views", "likes", "followers", "posts"]);
export const GET = route({}, async ({ req, viewer }) => {
  const m = str(req, "metric") ?? "views";
  return compareApps(viewer, rangeFrom(req), (METRICS.has(m) ? m : "views") as MetricKey);
});

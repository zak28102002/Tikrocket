"use client";

import { useState } from "react";
import { TimeChart } from "@/components/charts/time-chart";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChartPoint, Summary } from "@/lib/types";
import type { ResolvedRange } from "@/lib/range";
import { full } from "@/lib/format";

type Key = "views" | "likes" | "followers" | "posts";
const LABELS: Record<Key, { label: string; sub: string }> = {
  views: { label: "Views", sub: "Views gained per day" },
  likes: { label: "Likes", sub: "Likes gained per day" },
  followers: { label: "Followers", sub: "Total followers" },
  posts: { label: "Posts", sub: "Posts published per day" },
};

/** One chart, switchable metric. Same geometry across metrics, so paths morph smoothly. */
export function MetricChart({
  charts,
  kpis,
  range,
  height = 280,
  title,
}: {
  charts?: Record<Key, ChartPoint[]>;
  kpis?: Record<Key, Summary>;
  range?: ResolvedRange;
  height?: number;
  title?: string;
}) {
  const [metric, setMetric] = useState<Key>("views");
  const s = kpis?.[metric];
  return (
    <section className="card px-2 pt-5 pb-3 sm:px-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 px-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{title ?? "Performance"}</h2>
          <p className="mt-0.5 text-[13px] text-fg-3">
            {LABELS[metric].sub}
            {s && s.value !== null && (
              <>
                {" · "}
                <span className="text-fg-2 tnum">{full(s.value)}</span> {s.kind === "stock" ? "now" : range?.label.toLowerCase()}
              </>
            )}
          </p>
        </div>
        <Segmented
          ariaLabel="Metric"
          value={metric}
          onChange={setMetric}
          options={(Object.keys(LABELS) as Key[]).map((k) => ({ value: k, label: LABELS[k].label }))}
        />
      </div>
      {charts ? (
        <TimeChart
          series={[{ id: "m", label: LABELS[metric].label, color: "var(--chart-line)", points: charts[metric] }]}
          area
          height={height}
          valueLabel={LABELS[metric].label}
          animationKey={range ? `${range.from}-${range.to}` : undefined}
          emptyLabel={
            kpis?.views.lifetime !== null && kpis?.views.lifetime !== undefined
              ? "Tracking just started. Daily trends appear after the next update."
              : "No data for this period yet"
          }
        />
      ) : (
        <div className="px-3 pb-3">
          <Skeleton className="w-full rounded-xl" style={{ height: height - 16 }} />
        </div>
      )}
    </section>
  );
}

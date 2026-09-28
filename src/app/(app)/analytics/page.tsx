"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/shell/page-header";
import { RangeLabel } from "@/components/shell/range-picker";
import { TimeChart } from "@/components/charts/time-chart";
import { BarList } from "@/components/charts/bar-list";
import { Segmented } from "@/components/ui/segmented";
import { AppIcon } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Delta } from "@/components/ui/delta";
import { FilterPill } from "@/components/ui/filter-pill";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useRange } from "@/hooks/use-range";
import { api } from "@/lib/api";
import { compact, full } from "@/lib/format";
import { PLATFORM_META, PLATFORMS } from "@/lib/platforms";
import type { CompareResponse } from "@/lib/types";
import { cn } from "@/lib/cn";

type M = "views" | "likes" | "followers" | "posts";
const METRICS: { value: M; label: string }[] = [
  { value: "views", label: "Views" },
  { value: "likes", label: "Likes" },
  { value: "followers", label: "Followers" },
  { value: "posts", label: "Posts" },
];
const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)"];

export default function AnalyticsPage() {
  const { qs } = useRange();
  const [metric, setMetric] = useState<M>("views");
  const [exportApp, setExportApp] = useState<string | null>(null);
  const [exportPlatform, setExportPlatform] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["compare", metric, qs],
    queryFn: () => api<CompareResponse>(`/api/v1/analytics/compare?metric=${metric}&${qs}`),
    placeholderData: keepPreviousData,
  });
  const d = q.data;
  // Up to six named series; the rest fold into the table below (never a generated 7th hue).
  const colored = d?.apps.slice(0, COLORS.length) ?? [];
  const stock = metric === "followers";
  const ranked = d ? [...d.apps].sort((a, b) => (b.summary.value ?? -1) - (a.summary.value ?? -1)) : [];

  const exportHref = (() => {
    const p = new URLSearchParams(qs);
    if (exportApp) p.set("appId", exportApp);
    if (exportPlatform) p.set("platform", exportPlatform);
    return `/api/v1/export?${p}`;
  })();

  return (
    <>
      <PageHeader title="Analytics" description="Compare your apps side by side, and take the data with you." />

      <section className="card px-2 pt-5 pb-4 sm:px-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 px-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">App comparison</h2>
            <p className="mt-0.5 text-[13px] text-fg-3">{stock ? "Total followers over time" : `${METRICS.find((m) => m.value === metric)?.label} gained per day`}</p>
          </div>
          <Segmented ariaLabel="Metric" value={metric} onChange={setMetric} options={METRICS} />
        </div>
        {d && (
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 px-3" aria-label="Legend">
            {colored.map((a, i) => (
              <span key={a.id} className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-2">
                <span className="h-0.5 w-3 rounded-full" style={{ background: COLORS[i] }} />
                {a.name}
              </span>
            ))}
          </div>
        )}
        {d ? (
          <TimeChart
            series={colored.map((a, i) => ({ id: a.id, label: a.name, color: COLORS[i], points: a.series }))}
            height={320}
            valueLabel={METRICS.find((m) => m.value === metric)!.label}
            animationKey={`${metric}-${d.range.from}`}
          />
        ) : (
          <div className="px-3">
            <Skeleton className="h-[300px] w-full rounded-xl" />
          </div>
        )}
      </section>

      <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section>
          <SectionHeader title={stock ? "Followers today" : `${METRICS.find((m) => m.value === metric)?.label} · share of portfolio`} description={<RangeLabel />} />
          {q.isError ? (
            <ErrorState compact onRetry={() => q.refetch()} />
          ) : d ? (
            <BarList
              items={ranked.map((a) => ({
                key: a.id,
                label: (
                  <>
                    <AppIcon name={a.name} url={a.iconUrl} seed={a.iconSeed} size={18} />
                    {a.name}
                  </>
                ),
                value: a.summary.value,
                color: COLORS[d.apps.findIndex((x) => x.id === a.id)] ?? "var(--fg-3)",
              }))}
            />
          ) : (
            <Skeleton className="h-40 w-full" />
          )}
        </section>

        <section>
          <SectionHeader title="Details" description="The same numbers, as a table" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[440px] text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] text-fg-3 hairline-b">
                  <th className="py-2 pr-4 font-medium">App</th>
                  <th className="py-2 pr-4 text-right font-medium">{stock ? "Followers" : "This period"}</th>
                  <th className="py-2 pr-4 text-right font-medium">{stock ? "Net change" : "Previous"}</th>
                  <th className="py-2 pr-4 text-right font-medium">Growth</th>
                  <th className="py-2 text-right font-medium">Lifetime</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((a) => (
                  <tr key={a.id} className="hairline-b transition-colors hover:bg-surface-hover">
                    <td className="py-2.5 pr-4">
                      <span className="flex items-center gap-2 font-medium text-fg">
                        <AppIcon name={a.name} url={a.iconUrl} seed={a.iconSeed} size={20} />
                        {a.name}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-fg tnum">{full(a.summary.value)}</td>
                    <td className="py-2.5 pr-4 text-right text-fg-2 tnum">{stock ? full(a.summary.change) : full(a.summary.previous)}</td>
                    <td className="py-2.5 pr-4 text-right">
                      <Delta value={a.summary.changePct} showNull />
                    </td>
                    <td className="py-2.5 text-right text-fg-2 tnum">{compact(a.summary.lifetime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card mt-14 flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <FileSpreadsheet size={18} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-fg">Export CSV</h2>
            <p className="mt-0.5 max-w-md text-[13px] text-fg-3">
              One row per account per day for <span className="text-fg-2"><RangeLabel /></span>: date, app, platform, account, followers, posts, views, likes, comments and shares. Unavailable values export as N/A.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill label="App" allLabel="All apps" value={exportApp} onChange={setExportApp} options={(d?.apps ?? []).map((a) => ({ value: a.id, label: a.name }))} />
          <FilterPill label="Platform" allLabel="All platforms" value={exportPlatform} onChange={setExportPlatform} options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_META[p].label, icon: <PlatformIcon platform={p} size={13} /> }))} />
          <a href={exportHref} download className={cn("inline-flex")}>
            <Button variant="primary" icon={<Download size={14} />} tabIndex={-1}>
              Download
            </Button>
          </a>
        </div>
      </section>
    </>
  );
}

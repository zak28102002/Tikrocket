"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, Boxes, Plus } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/shell/page-header";
import { RangeTabs } from "@/components/shell/range-picker";
import { useModals } from "@/components/shell/modals";
import { KpiStrip, KpiStripSkeleton } from "@/components/pulse/kpi";
import { AppRow, AppRowsHeader, AppRowsSkeleton } from "@/components/pulse/app-rows";
import { TopAccounts, AccountRowsSkeleton } from "@/components/pulse/account-rows";
import { ContentCard, ContentCardSkeleton } from "@/components/pulse/content-card";
import { ActivityFeed, ActivitySkeleton } from "@/components/pulse/activity-feed";
import { TimeChart } from "@/components/charts/time-chart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useCan } from "@/components/providers";
import { useRange, useRangeHref } from "@/hooks/use-range";
import { api } from "@/lib/api";
import { compact, full, greeting } from "@/lib/format";
import type { OverviewResponse } from "@/lib/types";
import { cn } from "@/lib/cn";

function ViewAll({ href }: { href: string }) {
  const withRange = useRangeHref();
  return (
    <Link href={withRange(href)} className="group inline-flex items-center gap-1 text-[12.5px] font-medium text-fg-3 transition-colors hover:text-fg">
      View all <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function DataHealth({ counts }: { counts: OverviewResponse["counts"] }) {
  const rows = [
    { label: "Healthy", value: counts.healthy, dot: "bg-positive" },
    { label: "Collecting", value: counts.syncing, dot: "bg-accent" },
    { label: "Data unavailable", value: counts.unavailable, dot: "bg-fg-4" },
    { label: "Needs attention", value: Math.max(0, counts.accounts - counts.healthy - counts.syncing - counts.unavailable), dot: "bg-negative" },
  ];
  return (
    <div className="card p-5">
      <p className="text-[13px] font-medium text-fg-2">Tracking</p>
      <p className="display mt-2 text-[28px] leading-none font-semibold text-fg tnum">{counts.accounts}</p>
      <p className="mt-1 text-[12.5px] text-fg-3">
        accounts across {counts.apps} {counts.apps === 1 ? "app" : "apps"}
      </p>
      <div className="mt-4 flex h-1.5 gap-[2px] overflow-hidden rounded-full bg-surface-hover">
        {rows.map((r) => (r.value > 0 ? <span key={r.label} className={cn("h-full first:rounded-l-full last:rounded-r-full", r.dot)} style={{ flex: r.value }} /> : null))}
      </div>
      <ul className="mt-4 space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between text-[12.5px]">
            <span className="flex items-center gap-2 text-fg-2">
              <span className={cn("size-1.5 rounded-full", r.dot)} />
              {r.label}
            </span>
            <span className="text-fg tnum">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function OverviewPage() {
  const { qs } = useRange();
  const can = useCan();
  const modals = useModals();
  const q = useQuery({
    queryKey: ["overview", qs],
    queryFn: () => api<OverviewResponse>(`/api/v1/overview?${qs}`),
    placeholderData: keepPreviousData,
  });
  const d = q.data;

  const header = (
    <PageHeader
      title={<span suppressHydrationWarning>{greeting()}.</span>}
      description="Here's how your apps are performing."
      actions={
        can.edit && d && d.counts.apps > 0 ? (
          <Button variant="secondary" icon={<Plus size={14} />} onClick={modals.newApp} className="hidden sm:inline-flex">
            New app
          </Button>
        ) : null
      }
    />
  );

  if (q.isError && !d) {
    return (
      <>
        {header}
        <ErrorState onRetry={() => q.refetch()} message="We couldn't load your dashboard. It's usually temporary." />
      </>
    );
  }

  if (d && d.counts.apps === 0) {
    return (
      <>
        {header}
        <div className="card mt-2">
          <EmptyState
            icon={<Boxes size={22} strokeWidth={1.5} />}
            title="No apps yet"
            description="Create your first app to start tracking social performance."
            action={
              can.edit ? (
                <Button variant="primary" size="lg" icon={<Plus size={15} />} onClick={modals.newApp}>
                  Create your first app
                </Button>
              ) : undefined
            }
          />
        </div>
      </>
    );
  }

  const noAccounts = d && d.counts.accounts === 0;

  return (
    <>
      {header}

      {/* KPIs */}
      <div className={cn("transition-opacity duration-200", q.isPlaceholderData && "opacity-60")}>
        {d ? <KpiStrip kpis={d.kpis} range={d.range} /> : <KpiStripSkeleton />}
      </div>

      {/* Main chart */}
      <section className="card mt-10 px-2 pt-5 pb-3 sm:px-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 px-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Views</h2>
            <p className="mt-0.5 text-[13px] text-fg-3">
              {d ? (
                <>
                  Views gained per day
                  {d.kpis.views.value !== null && (
                    <>
                      {" "}
                      · <span className="text-fg-2 tnum">{full(d.kpis.views.value)}</span> in total
                    </>
                  )}
                </>
              ) : (
                <Skeleton className="inline-block h-3 w-40 align-middle" />
              )}
            </p>
          </div>
          <RangeTabs />
        </div>
        {d ? (
          <TimeChart
            series={[{ id: "views", label: "Views", color: "var(--chart-line)", points: d.chart }]}
            area
            height={300}
            valueLabel="Views"
            animationKey={`${d.range.from}-${d.range.to}`}
            emptyLabel={noAccounts ? "Add a social account to start collecting views" : "No views recorded in this period yet"}
          />
        ) : (
          <div className="px-3 pb-3">
            <Skeleton className="h-[284px] w-full rounded-xl" />
          </div>
        )}
      </section>

      {/* Apps */}
      <section className="mt-14">
        <SectionHeader title="Apps" description={d ? `${d.range.label} · sorted by views` : " "} action={<ViewAll href="/apps" />} />
        <AppRowsHeader />
        <div className={cn("transition-opacity", q.isPlaceholderData && "opacity-60")}>
          {d ? d.apps.map((a) => <AppRow key={a.id} app={a} />) : <AppRowsSkeleton />}
        </div>
      </section>

      {/* Top accounts + tracking health */}
      <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section>
          <SectionHeader title="Top accounts" description={d ? `Most views gained · ${d.range.label.toLowerCase()}` : " "} action={<ViewAll href="/accounts" />} />
          {d ? (
            d.topAccounts.length ? (
              <TopAccounts rows={d.topAccounts} />
            ) : (
              <p className="rounded-xl bg-surface-2 px-4 py-8 text-center text-[13px] text-fg-3">View data appears after the first collection.</p>
            )
          ) : (
            <AccountRowsSkeleton rows={5} />
          )}
        </section>
        <aside className="lg:pt-10">{d ? <DataHealth counts={d.counts} /> : <Skeleton className="h-56 w-full rounded-2xl" />}</aside>
      </div>

      {/* Top content */}
      <section className="mt-14">
        <SectionHeader
          title="Top content"
          description={d ? (d.range.key === "all" ? "Most viewed, all time" : `Most views gained · ${d.range.label.toLowerCase()}`) : " "}
          action={<ViewAll href="/content" />}
        />
        {d ? (
          d.topContent.length ? (
            <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pt-1 pb-3 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
              {d.topContent.map((p) => (
                <ContentCard key={p.id} post={p} showPeriod={d.range.key !== "all"} periodLabel={`Views gained · ${d.range.label}`} className="w-[168px] shrink-0 snap-start sm:w-[184px]" />
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-surface-2 px-4 py-10 text-center text-[13px] text-fg-3">
              {noAccounts ? "Content appears once accounts are connected." : "No content gained views in this period."}
            </p>
          )
        ) : (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-[184px] shrink-0">
                <ContentCardSkeleton />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Activity */}
      <section className="mt-14 max-w-3xl">
        <SectionHeader title="Recent activity" />
        {d ? (
          d.activity.length ? (
            <ActivityFeed items={d.activity} />
          ) : (
            <p className="text-[13px] text-fg-3">Activity appears as Pulse collects data.</p>
          )
        ) : (
          <ActivitySkeleton />
        )}
      </section>
      <p className="sr-only">{d ? `Total views ${compact(d.kpis.views.value)}` : ""}</p>
    </>
  );
}

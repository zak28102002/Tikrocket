"use client";

import type { ReactNode } from "react";
import { CountUp } from "@/components/ui/count-up";
import { Delta } from "@/components/ui/delta";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { compact, dayLabel, NA, signed } from "@/lib/format";
import type { Summary } from "@/lib/types";
import type { ResolvedRange } from "@/lib/range";
import { cn } from "@/lib/cn";

/** "vs previous 30 days" — or an honest reason there's no comparison. */
function Comparison({ s, range }: { s: Summary; range: ResolvedRange }) {
  if (s.value === null) {
    return <span className="text-fg-3">{s.lifetime !== null ? "Tracking just started" : "Not available"}</span>;
  }
  if (s.kind === "stock") {
    if (s.change === null) return <span className="text-fg-3">{range.label}</span>;
    return (
      <>
        <Delta value={s.changePct} />
        <span className="text-fg-3">
          {signed(s.change)} {range.key === "all" ? "since tracking began" : range.label.toLowerCase().replace("last", "in the last")}
        </span>
      </>
    );
  }
  if (!range.compareLabel) return <span className="text-fg-3">All time</span>;
  if (!s.comparable || s.changePct === null) {
    return (
      <Tooltip content={s.partialSince ? `Tracking began ${dayLabel(s.partialSince)}. Comparisons appear once a full previous period is recorded.` : "Comparisons appear once a full previous period is recorded."}>
        <span className="cursor-help text-fg-3 underline decoration-[var(--line-strong)] decoration-dotted underline-offset-4">
          {s.partialSince ? `Since ${dayLabel(s.partialSince)}` : "No comparison yet"}
        </span>
      </Tooltip>
    );
  }
  return (
    <>
      <Delta value={s.changePct} />
      <span className="text-fg-3">{range.compareLabel}</span>
    </>
  );
}

function Lifetime({ s, noun }: { s: Summary; noun: string }) {
  if (s.kind === "stock" || s.lifetime === null) return null;
  return (
    <span className="text-fg-3">
      <span className="font-medium text-fg-2 tnum">{compact(s.lifetime)}</span> {noun} lifetime
    </span>
  );
}

export function HeroMetric({ label, s, range, extra }: { label: string; s: Summary; range: ResolvedRange; extra?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center gap-2 text-[13px] text-fg-2">
        <span className="font-medium">{label}</span>
        <span className="text-fg-4">·</span>
        <span className="text-fg-3">{range.label}</span>
      </div>
      <div className="display mt-3 text-[56px] leading-[0.95] font-semibold text-fg sm:text-[64px]">
        <CountUp value={s.value} format={compact} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <Comparison s={s} range={range} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[12.5px]">
        <Lifetime s={s} noun="views" />
        {s.today !== null && s.value !== null && range.key !== "all" && (
          <span className="text-fg-3">
            <span className="font-medium text-fg-2 tnum">{signed(s.today)}</span> today
          </span>
        )}
        {extra}
      </div>
    </div>
  );
}

export function SmallMetric({ label, s, range, noun, className }: { label: string; s: Summary; range: ResolvedRange; noun: string; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <span className="text-[13px] font-medium text-fg-2">{label}</span>
      <span className="display mt-2.5 text-[22px] leading-none font-semibold text-fg sm:text-[30px]">
        <CountUp value={s.value} format={compact} />
      </span>
      <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px]">
        <Comparison s={s} range={range} />
      </div>
      <div className="mt-1 text-[12px]">
        <Lifetime s={s} noun={noun} />
      </div>
    </div>
  );
}

/** One dominant metric + quieter supporting metrics, in a single composed surface. */
export function KpiStrip({
  kpis,
  range,
}: {
  kpis: { views: Summary; likes: Summary; posts: Summary; followers: Summary };
  range: ResolvedRange;
}) {
  return (
    <section className="grid grid-cols-1 gap-y-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,2fr)]" aria-label="Key metrics">
      <HeroMetric label="Views" s={kpis.views} range={range} />
      <div className="grid grid-cols-3 border-t border-[var(--line)] pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-2">
        <SmallMetric label="Likes" s={kpis.likes} range={range} noun="likes" className="pr-3 sm:px-6 lg:pl-6" />
        <SmallMetric label="Posts" s={kpis.posts} range={range} noun="posts" className="border-l border-[var(--line)] px-3 sm:px-6" />
        <SmallMetric label="Followers" s={kpis.followers} range={range} noun="followers" className="border-l border-[var(--line)] pl-3 sm:px-6" />
      </div>
    </section>
  );
}

export function KpiStripSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-y-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,2fr)]">
      <div>
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-4 h-14 w-56" />
        <Skeleton className="mt-5 h-3.5 w-48" />
        <Skeleton className="mt-2 h-3.5 w-32" />
      </div>
      <div className="grid grid-cols-3 gap-6 lg:pl-8">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="mt-3.5 h-8 w-24" />
            <Skeleton className="mt-4 h-3 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

export { NA };

"use client";

import type { ReactNode } from "react";
import { CountUp } from "@/components/ui/count-up";
import { Delta } from "@/components/ui/delta";
import { compact, signed } from "@/lib/format";
import type { Summary } from "@/lib/types";
import { cn } from "@/lib/cn";

type Kpis = { views: Summary; likes: Summary; posts: Summary; followers: Summary };

function Stat({ label, value, sub, className }: { label: string; value: number | null; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[12.5px] font-medium text-fg-3">{label}</p>
      <p className="display mt-2 text-[26px] leading-none font-semibold text-fg">
        <CountUp value={value} format={compact} />
      </p>
      <div className="mt-2 flex h-4 items-center gap-1.5 text-[12px] text-fg-3">{sub}</div>
    </div>
  );
}

const growth = (s: Summary) =>
  s.value === null && s.lifetime !== null ? <span>Tracking just started</span> : s.comparable ? <Delta value={s.changePct} size="sm" /> : null;

/** Five clearly-labelled figures: lifetime is never confused with the period. */
export function DetailKpis({ kpis, periodLabel }: { kpis: Kpis; periodLabel: string }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-5 lg:gap-0 lg:divide-x lg:divide-[var(--line)]">
      <Stat label="Lifetime views" value={kpis.views.lifetime} sub={kpis.views.lifetime !== null ? <span>All time</span> : null} className="lg:pr-6" />
      <Stat label={`Views · ${periodLabel.replace("Last ", "")}`} value={kpis.views.value} sub={growth(kpis.views) ?? <span>{kpis.views.today !== null ? `${signed(kpis.views.today)} today` : ""}</span>} className="lg:px-6" />
      <Stat label="Likes" value={kpis.likes.value} sub={growth(kpis.likes) ?? (kpis.likes.lifetime !== null ? <span>{compact(kpis.likes.lifetime)} lifetime</span> : null)} className="lg:px-6" />
      <Stat label="Posts" value={kpis.posts.value} sub={kpis.posts.lifetime !== null ? <span>{compact(kpis.posts.lifetime)} lifetime</span> : null} className="lg:px-6" />
      <Stat
        label="Followers"
        value={kpis.followers.value}
        sub={kpis.followers.change !== null ? <span className="tnum">{signed(kpis.followers.change)} this period</span> : null}
        className="lg:pl-6"
      />
    </div>
  );
}


"use client";

import Link from "next/link";
import { AlertTriangle, Plus, Sparkles, TrendingUp, Video } from "lucide-react";
import type { ActivityItem } from "@/lib/types";
import { PLATFORM_META } from "@/lib/platforms";
import { compact, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/skeleton";

function describe(a: ActivityItem): { title: string; icon: typeof Video; tone: "accent" | "neutral" | "negative" | "positive" } {
  const p = a.payload ?? {};
  switch (a.type) {
    case "POST_DETECTED":
      return { title: "New video detected", icon: Video, tone: "accent" };
    case "ACCOUNT_ADDED":
      return { title: "Account connected", icon: Plus, tone: "neutral" };
    case "VIEWS_MILESTONE":
      return { title: `+${compact(Number(p.viewsGained ?? 0))} views detected`, icon: Sparkles, tone: "positive" };
    case "ACCOUNT_UPDATED":
      return {
        title: typeof p.viewsGained === "number" ? `+${compact(p.viewsGained)} views detected` : "Account updated",
        icon: TrendingUp,
        tone: "neutral",
      };
    case "SYNC_FAILED":
      return { title: "Couldn't update account", icon: AlertTriangle, tone: "negative" };
  }
}

const TONES = {
  accent: "bg-accent-soft text-accent",
  neutral: "bg-surface-hover text-fg-2",
  positive: "bg-positive-soft text-positive",
  negative: "bg-negative-soft text-negative",
};

/** Quiet vertical timeline of what Pulse noticed. */
export function ActivityFeed({ items, compact: dense, onNavigate }: { items: ActivityItem[]; compact?: boolean; onNavigate?: () => void }) {
  return (
    <ol className="relative">
      {items.map((a, i) => {
        const d = describe(a);
        const Icon = d.icon;
        const href = a.post ? `/content/${a.post.id}` : a.account ? `/accounts/${a.account.id}` : "#";
        return (
          <li key={a.id} className="relative">
            {i < items.length - 1 && <span className={cn("absolute left-[15px] w-px bg-[var(--line)]", dense ? "top-8 bottom-0" : "top-9 -bottom-0")} aria-hidden />}
            <Link href={href} onClick={onNavigate} className={cn("group flex gap-3 rounded-lg transition-colors hover:bg-surface-hover", dense ? "px-2 py-2" : "-mx-2 px-2 py-2.5")}>
              <span className={cn("relative z-10 flex size-[30px] shrink-0 items-center justify-center rounded-full ring-4 ring-[var(--surface)]", TONES[d.tone])}>
                <Icon size={14} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1 pt-[1px]">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] font-medium text-fg">{d.title}</span>
                  <span className="shrink-0 text-[11.5px] text-fg-3 tnum">{timeAgo(a.createdAt)}</span>
                </span>
                {a.account && (
                  <span className="mt-0.5 block truncate text-[12.5px] text-fg-3">
                    @{a.account.username} · {PLATFORM_META[a.account.platform].label}
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function ActivitySkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4 py-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-[30px] rounded-full" />
          <div className="flex-1 space-y-1.5 pt-1">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

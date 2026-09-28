"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { AppSummary } from "@/lib/types";
import { AppIcon } from "@/components/ui/avatar";
import { Delta } from "@/components/ui/delta";
import { Sparkline } from "@/components/charts/sparkline";
import { Skeleton } from "@/components/ui/skeleton";
import { compact } from "@/lib/format";
import { useRangeHref } from "@/hooks/use-range";
import { cn } from "@/lib/cn";

const COLS = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 md:grid-cols-[minmax(180px,1.4fr)_minmax(170px,1.3fr)_repeat(4,minmax(64px,.6fr))_16px]";

export function AppRowsHeader() {
  return (
    <div className={cn(COLS, "hidden h-8 px-3 text-[11.5px] font-medium text-fg-3 md:grid")}>
      <span>App</span>
      <span>Views</span>
      <span className="text-right">Growth</span>
      <span className="text-right">Likes</span>
      <span className="text-right">Posts</span>
      <span className="text-right">Followers</span>
      <span />
    </div>
  );
}

export function AppRow({ app }: { app: AppSummary }) {
  const href = useRangeHref();
  const growth = app.views.comparable ? app.views.changePct : null;
  return (
    <Link
      href={href(`/apps/${app.id}`)}
      className={cn(
        COLS,
        "group relative -mx-0 rounded-xl px-3 py-3.5 transition-[background-color,transform] duration-200 hover:bg-surface-hover active:scale-[0.998]",
      )}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <AppIcon name={app.name} url={app.iconUrl} seed={app.iconSeed} size={38} className="transition-transform duration-300 group-hover:scale-[1.04]" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-fg">{app.name}</p>
          <p className="truncate text-[12.5px] text-fg-3">
            {app.accountCount} {app.accountCount === 1 ? "account" : "accounts"}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-4 md:justify-start">
        <div className="text-right md:min-w-[72px] md:text-left">
          <p className="display text-[18px] leading-tight font-semibold text-fg tnum">{compact(app.views.value)}</p>
          <p className="text-[11.5px] text-fg-3 md:hidden">
            <Delta value={growth} size="sm" showNull />
          </p>
        </div>
        <Sparkline values={app.spark} width={96} height={30} className="hidden sm:block" />
      </div>
      <span className="hidden text-right md:block">
        <Delta value={growth} showNull />
      </span>
      <span className="hidden text-right text-[13px] text-fg-2 tnum md:block">{compact(app.likes.value)}</span>
      <span className="hidden text-right text-[13px] text-fg-2 tnum md:block">{compact(app.posts.value)}</span>
      <span className="hidden text-right text-[13px] text-fg-2 tnum md:block">{compact(app.followers.value)}</span>
      <ChevronRight size={15} className="hidden text-fg-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-fg-3 md:block" />
    </Link>
  );
}

export function AppRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-3 py-3.5">
          <Skeleton className="size-[38px] rounded-[10px]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-5 w-16" />
          <Skeleton className="hidden h-6 w-24 sm:block" />
          <Skeleton className="hidden h-3.5 w-12 md:block" />
          <Skeleton className="hidden h-3.5 w-12 md:block" />
        </div>
      ))}
    </div>
  );
}

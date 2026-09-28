"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, RefreshCw, ExternalLink, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { AccountRow as Row } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Delta } from "@/components/ui/delta";
import { Button, IconButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { PLATFORM_META } from "@/lib/platforms";
import { compact, timeAgo } from "@/lib/format";
import { useRangeHref } from "@/hooks/use-range";
import { useRefreshAccount } from "@/hooks/use-refresh";
import { useCan } from "@/components/providers";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { StatusBadge } from "./status";
import { Sparkline } from "@/components/charts/sparkline";

const COLS =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 lg:grid-cols-[minmax(200px,1.6fr)_repeat(4,minmax(64px,.55fr))_minmax(120px,.9fr)_auto]";

export function AccountRowsHeader({ periodLabel }: { periodLabel: string }) {
  return (
    <div className={cn(COLS, "sticky top-0 z-[1] hidden h-9 bg-surface px-3 text-[11.5px] font-medium text-fg-3 hairline-b lg:grid")}>
      <span>Account</span>
      <span className="text-right">Followers</span>
      <span className="text-right" title={periodLabel}>
        Views
      </span>
      <span className="text-right">Posts</span>
      <span className="text-right">Growth</span>
      <span className="pl-4">Status</span>
      <span className="w-[108px]" />
    </div>
  );
}

export function AccountRow({ row, showApp = true }: { row: Row; showApp?: boolean }) {
  const href = useRangeHref();
  const router = useRouter();
  const can = useCan();
  const qc = useQueryClient();
  const toast = useToast();
  const { refresh, refreshing } = useRefreshAccount(row.id, row.activeJobId);
  const status = refreshing && row.status !== "PENDING" ? "SYNCING" : row.status;
  const link = href(`/accounts/${row.id}`);

  return (
    <div
      className={cn(COLS, "group relative cursor-pointer rounded-xl px-3 py-3 transition-colors duration-150 hover:bg-surface-hover")}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button,a,[role=menu]")) return;
        router.push(link);
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={row.username} url={row.avatarUrl} size={36} platform={row.platform} />
        <div className="min-w-0">
          <Link href={link} className="block truncate text-[14px] font-medium text-fg hover:underline hover:decoration-[var(--line-strong)] hover:underline-offset-4">
            @{row.username}
          </Link>
          <p className="truncate text-[12.5px] text-fg-3">
            {PLATFORM_META[row.platform].label}
            {showApp && <> · {row.app.name}</>}
            <span className="lg:hidden"> · {timeAgo(row.lastSyncedAt)}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-right lg:hidden">
        <div>
          <p className="text-[14px] font-semibold text-fg tnum">{compact(row.period.views)}</p>
          <p className="text-[11.5px] text-fg-3">views</p>
        </div>
        <StatusBadge status={status} message={row.userError} className="[&>span:last-child]:hidden" />
      </div>
      <span className="hidden text-right text-[13px] text-fg-2 tnum lg:block">{compact(row.followers)}</span>
      <Tooltip content={row.totalViews !== null ? `${compact(row.totalViews)} lifetime${row.viewsSource === "POSTS" ? " (sum of tracked posts)" : ""}` : null}>
        <span className="hidden text-right text-[13px] font-semibold text-fg tnum lg:block">{compact(row.period.views)}</span>
      </Tooltip>
      <span className="hidden text-right text-[13px] text-fg-2 tnum lg:block">{compact(row.postCount)}</span>
      <span className="hidden text-right lg:block">
        <Delta value={row.period.viewsPct} showNull />
      </span>
      <div className="hidden min-w-0 flex-col pl-4 lg:flex">
        <StatusBadge status={status} message={row.userError} />
        <span className="text-[11.5px] text-fg-3">{refreshing ? "Updating now" : `Updated ${timeAgo(row.lastSyncedAt).toLowerCase()}`}</span>
      </div>
      <div className="hidden w-[108px] items-center justify-end gap-1 lg:flex">
        <Button size="sm" variant="ghost" onClick={() => router.push(link)}>
          View
        </Button>
        {can.edit && (
          <Tooltip content="Refresh now">
            <IconButton size="sm" label="Refresh" onClick={refresh} disabled={refreshing}>
              <RefreshCw size={14} className={cn(refreshing && "animate-spin")} />
            </IconButton>
          </Tooltip>
        )}
        <Menu>
          <MenuTrigger asChild>
            <IconButton size="sm" label="More">
              <MoreHorizontal size={15} />
            </IconButton>
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={<ExternalLink size={14} />} onSelect={() => window.open(row.profileUrl, "_blank", "noopener")}>
              Open on {PLATFORM_META[row.platform].label}
            </MenuItem>
            {can.admin && (
              <>
                <MenuSeparator />
                <MenuItem
                  danger
                  icon={<Trash2 size={14} />}
                  onSelect={async () => {
                    if (!confirm(`Stop tracking @${row.username}? Its history will be deleted.`)) return;
                    await api(`/api/v1/accounts/${row.id}`, { method: "DELETE" });
                    qc.invalidateQueries();
                    toast({ title: `@${row.username} removed` });
                  }}
                >
                  Remove account
                </MenuItem>
              </>
            )}
          </MenuContent>
        </Menu>
      </div>
    </div>
  );
}

export function AccountRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="hidden h-3.5 w-14 lg:block" />
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="hidden h-3.5 w-10 lg:block" />
          <Skeleton className="hidden h-3.5 w-24 lg:block" />
        </div>
      ))}
    </div>
  );
}

/** Ranked list for the overview. Quiet numerals, no podium theatrics. */
export function TopAccounts({ rows }: { rows: (Row & { rank: number })[] }) {
  const href = useRangeHref();
  return (
    <ol className="-mx-2">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={href(`/accounts/${r.id}`)} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-hover">
            <span className="w-4 text-center text-[12px] font-medium text-fg-4 tnum">{r.rank}</span>
            <Avatar name={r.username} url={r.avatarUrl} size={34} platform={r.platform} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-fg">@{r.username}</p>
              <p className="truncate text-[12px] text-fg-3">
                {PLATFORM_META[r.platform].label} · {r.app.name}
              </p>
            </div>
            <Sparkline values={r.spark} width={120} height={28} className="hidden sm:block" />
            <div className="hidden w-24 text-right md:block">
              <p className="text-[13px] text-fg-2 tnum">{compact(r.followers)}</p>
              <p className="text-[11.5px] text-fg-3">followers</p>
            </div>
            <div className="w-20 text-right">
              <p className="text-[13.5px] font-semibold text-fg tnum">{compact(r.period.views)}</p>
              <Delta value={r.period.viewsPct} size="sm" />
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

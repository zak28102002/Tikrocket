"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BadgeCheck, ChevronLeft, Clock, ExternalLink, RefreshCw } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/shell/page-header";
import { MetricChart } from "@/components/pulse/metric-chart";
import { DetailKpis } from "@/components/pulse/detail-kpis";
import { ContentGrid } from "@/components/pulse/content-grid";
import { StatusBadge } from "@/components/pulse/status";
import { Avatar, AppIcon } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Tooltip } from "@/components/ui/tooltip";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { useCan } from "@/components/providers";
import { useRange, useRangeHref } from "@/hooks/use-range";
import { useRefreshAccount } from "@/hooks/use-refresh";
import { api, ApiError } from "@/lib/api";
import { compact, full, rate, refreshLabel, timeAgo, timeUntil } from "@/lib/format";
import { PLATFORM_META } from "@/lib/platforms";
import type { AccountDetailResponse } from "@/lib/types";
import { cn } from "@/lib/cn";

function ProfileStat({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  const el = (
    <div className="min-w-0">
      <p className="text-[18px] font-semibold text-fg tnum">{compact(value)}</p>
      <p className="text-[12px] text-fg-3">{label}</p>
    </div>
  );
  return hint ? <Tooltip content={hint}>{el}</Tooltip> : el;
}

const INTERVALS: (number | null)[] = [null, 60, 360, 720, 1440, 0];

export default function AccountPage() {
  const { id } = useParams<{ id: string }>();
  const { qs } = useRange();
  const href = useRangeHref();
  const can = useCan();
  const qc = useQueryClient();
  const [sort, setSort] = useState<"newest" | "views">("views");
  const [showDetail, setShowDetail] = useState(false);

  const q = useQuery({
    queryKey: ["account", id, qs],
    queryFn: () => api<AccountDetailResponse>(`/api/v1/accounts/${id}?${qs}`),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (query.state.data?.account.status === "PENDING" ? 2500 : false),
  });
  const d = q.data?.account.id === id ? q.data : undefined;
  const a = d?.account;
  const { refresh, refreshing } = useRefreshAccount(id, a?.activeJobId ?? null);
  const setInterval_ = useMutation({
    mutationFn: (m: number | null) => api(`/api/v1/accounts/${id}`, { method: "PATCH", json: { refreshMinutes: m } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["account", id] }),
  });

  if (q.isError && !d) {
    const nf = q.error instanceof ApiError && q.error.status === 404;
    return <ErrorState title={nf ? "Account not found" : "Couldn't load this account"} message={nf ? "It may have been removed." : "It's usually temporary."} onRetry={nf ? undefined : () => q.refetch()} />;
  }

  return (
    <>
      <Link href={href(a ? `/apps/${a.app.id}` : "/accounts")} className="mb-4 inline-flex items-center gap-1 text-[12.5px] text-fg-3 transition-colors hover:text-fg">
        <ChevronLeft size={14} /> {a ? a.app.name : "Accounts"}
      </Link>
      <PageHeader
        leading={a ? <Avatar name={a.username} url={a.avatarUrl} size={56} /> : <Skeleton className="size-14 rounded-full" />}
        title={
          a ? (
            <span className="flex items-center gap-2">
              @{a.username}
              {a.isVerified && <BadgeCheck size={20} className="text-accent" aria-label="Verified" />}
            </span>
          ) : (
            <Skeleton className="h-7 w-44" />
          )
        }
        description={
          a ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-1.5 text-fg-2">
                <PlatformIcon platform={a.platform} size={13} /> {PLATFORM_META[a.platform].label}
              </span>
              {a.displayName && <span>· {a.displayName}</span>}
              <span>·</span>
              <Link href={href(`/apps/${a.app.id}`)} className="inline-flex items-center gap-1.5 hover:text-fg">
                <AppIcon name={a.app.name} url={a.app.iconUrl} seed={a.app.iconSeed} size={16} /> {a.app.name}
              </Link>
            </span>
          ) : (
            <Skeleton className="mt-1 h-3.5 w-56" />
          )
        }
        actions={
          a && (
            <>
              <Button variant="secondary" icon={<ExternalLink size={14} />} onClick={() => window.open(a.profileUrl, "_blank", "noopener")}>
                <span className="hidden sm:inline">Open profile</span>
              </Button>
              {can.edit && (
                <Button variant="secondary" icon={<RefreshCw size={14} className={cn(refreshing && "animate-spin")} />} onClick={refresh} disabled={refreshing}>
                  {refreshing ? "Updating…" : "Refresh"}
                </Button>
              )}
            </>
          )
        }
      />

      {/* Profile strip */}
      <section className="card flex flex-col gap-6 p-5 md:flex-row md:items-center md:justify-between">
        <div className="grid grid-cols-3 gap-x-8 gap-y-4 sm:grid-cols-5">
          <ProfileStat label="Followers" value={a?.followers ?? null} />
          <ProfileStat label="Following" value={a?.following ?? null} />
          <ProfileStat label="Total likes" value={a?.totalLikes ?? null} />
          <ProfileStat
            label="Total views"
            value={a?.totalViews ?? null}
            hint={a?.viewsSource === "POSTS" ? "Sum of views across all tracked posts" : a?.viewsSource === "PROFILE" ? "Lifetime views reported by the platform" : "Not available from this platform"}
          />
          <ProfileStat label="Posts" value={a?.postCount ?? null} />
        </div>
        <div className="flex flex-col gap-1.5 md:items-end">
          {a && <StatusBadge status={refreshing ? "SYNCING" : a.status} message={a.userError} />}
          <span className="text-[12px] text-fg-3">
            {a ? `Updated ${timeAgo(a.lastSyncedAt).toLowerCase()}` : ""}
            {a?.nextRefreshAt && a.refreshMinutes !== 0 ? ` · next update ${timeUntil(a.nextRefreshAt)}` : ""}
          </span>
          {a && can.edit && (
            <Menu>
              <MenuTrigger asChild>
                <button className="inline-flex items-center gap-1 text-[12px] text-fg-3 hover:text-fg">
                  <Clock size={12} /> {refreshLabel(a.refreshMinutes)}
                </button>
              </MenuTrigger>
              <MenuContent>
                <MenuLabel>Automatic refresh</MenuLabel>
                {INTERVALS.map((m) => (
                  <MenuItem key={String(m)} checked={a.refreshMinutes === m} onSelect={() => setInterval_.mutate(m)}>
                    {refreshLabel(m)}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          )}
        </div>
      </section>

      {a && (a.status === "ERROR" || a.status === "UNAVAILABLE") && (
        <div className={cn("mt-4 rounded-xl px-4 py-3 text-[13px]", a.status === "ERROR" ? "bg-negative-soft" : "bg-warning-soft")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className={cn("font-medium", a.status === "ERROR" ? "text-negative" : "text-warning")}>
                {a.status === "ERROR" ? "Couldn't update this account" : "Data unavailable"}
              </p>
              <p className="mt-0.5 text-fg-2">{a.userError}</p>
            </div>
            <div className="flex gap-2">
              {can.edit && (
                <Button size="sm" variant="secondary" onClick={refresh} loading={refreshing}>
                  Try again
                </Button>
              )}
              {a.devErrorDetail && (
                <Button size="sm" variant="ghost" onClick={() => setShowDetail((s) => !s)}>
                  {showDetail ? "Hide details" : "View details"}
                </Button>
              )}
            </div>
          </div>
          {showDetail && a.devErrorDetail && <pre className="mt-3 overflow-x-auto font-mono text-[11px] whitespace-pre-wrap text-fg-2">{a.devErrorDetail}</pre>}
        </div>
      )}

      {a?.bio && <p className="mt-4 max-w-2xl text-[13.5px] leading-relaxed whitespace-pre-line text-fg-2">{a.bio}</p>}

      <div className={cn("mt-10 transition-opacity", q.isPlaceholderData && "opacity-60")}>
        {d ? <DetailKpis kpis={d.kpis} periodLabel={d.range.label} /> : <Skeleton className="h-20 w-full" />}
      </div>
      {d && (
        <p className="mt-4 text-[12.5px] text-fg-3">
          Engagement rate <span className="font-medium text-fg-2 tnum">{rate(d.engagementRate, 2)}</span>
          <span className="mx-2 text-fg-4">·</span>
          Avg. views per post <span className="font-medium text-fg-2 tnum">{d.avgViewsPerPost === null ? "N/A" : full(Math.round(d.avgViewsPerPost))}</span>
          {!a?.connector.capabilities.postViews && <span className="ml-2">· {PLATFORM_META[a!.platform].label} doesn&apos;t share view counts for this profile.</span>}
        </p>
      )}

      <div className="mt-10">
        <MetricChart charts={d?.charts} kpis={d?.kpis} range={d?.range} title="Performance" />
      </div>

      <section className="mt-14">
        <SectionHeader
          title="Content"
          description="All collected posts"
          action={<Segmented size="sm" value={sort} onChange={setSort} options={[{ value: "views", label: "Most viewed" }, { value: "newest", label: "Newest" }]} />}
        />
        <ContentGrid query={`accountId=${id}&sort=${sort}`} empty={{ title: "No posts collected yet", description: "Posts appear after the first successful collection." }} />
      </section>
    </>
  );
}

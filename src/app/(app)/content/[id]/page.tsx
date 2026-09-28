"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ExternalLink, Flame } from "lucide-react";
import { SectionHeader } from "@/components/shell/page-header";
import { Thumb } from "@/components/pulse/content-card";
import { TimeChart } from "@/components/charts/time-chart";
import { Avatar, AppIcon } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { CountUp } from "@/components/ui/count-up";
import { api, ApiError } from "@/lib/api";
import { compact, dateLabel, duration, full, rate, signed, timeAgo } from "@/lib/format";
import { PLATFORM_META } from "@/lib/platforms";
import type { PostDetailResponse } from "@/lib/types";
import { cn } from "@/lib/cn";

function Metric({ label, value, format = compact, hint }: { label: string; value: number | null; format?: (n: number | null) => string; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-4 py-3.5 shadow-[0_0_0_1px_var(--line)]">
      <p className="text-[12px] font-medium text-fg-3">{label}</p>
      <p className="display mt-1.5 text-[24px] leading-none font-semibold text-fg">
        <CountUp value={value} format={format} />
      </p>
      {hint && <p className="mt-1.5 text-[11.5px] text-fg-3">{hint}</p>}
    </div>
  );
}

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const q = useQuery({ queryKey: ["post", id], queryFn: () => api<PostDetailResponse>(`/api/v1/posts/${id}`) });
  const d = q.data;

  if (q.isError) {
    const nf = q.error instanceof ApiError && q.error.status === 404;
    return <ErrorState title={nf ? "Post not found" : "Couldn't load this post"} onRetry={nf ? undefined : () => q.refetch()} />;
  }

  const p = d?.post;
  const tl = d?.timeline ?? [];
  const maxGain = Math.max(0, ...tl.map((t) => t.gained ?? 0));
  const breakout = tl.find((t) => t.gained === maxGain && maxGain > 0);
  const shownDays = tl.filter((t) => t.views !== null).slice(0, 14);

  return (
    <>
      <button onClick={() => router.back()} className="mb-6 inline-flex items-center gap-1 text-[12.5px] text-fg-3 transition-colors hover:text-fg">
        <ChevronLeft size={14} /> Back
      </button>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <div>
          {p ? (
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[20px] shadow-[0_0_0_1px_var(--line),0_24px_48px_-24px_rgba(0,0,0,.35)] lg:sticky lg:top-8">
              <Thumb post={p} className="absolute inset-0" sizes="large" />
              <div className="absolute top-3 left-3 flex h-7 items-center gap-1.5 rounded-full bg-black/40 px-2.5 text-[12px] font-medium text-white backdrop-blur-md">
                <PlatformIcon platform={p.platform} size={12} /> {PLATFORM_META[p.platform].label}
              </div>
              {duration(p.durationSec) && <div className="absolute right-3 bottom-3 rounded-md bg-black/50 px-1.5 py-0.5 text-[11px] font-medium text-white tnum">{duration(p.durationSec)}</div>}
            </div>
          ) : (
            <Skeleton className="aspect-[9/16] w-full rounded-[20px]" />
          )}
        </div>

        <div className="min-w-0">
          {p ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-fg-3">
                <Link href={`/accounts/${p.account.id}`} className="inline-flex items-center gap-2 font-medium text-fg hover:underline hover:underline-offset-4">
                  <Avatar name={p.account.username} url={p.account.avatarUrl} size={22} />@{p.account.username}
                </Link>
                <span>·</span>
                <Link href={`/apps/${p.app.id}`} className="inline-flex items-center gap-1.5 hover:text-fg">
                  <AppIcon name={p.app.name} url={p.app.iconUrl} seed={p.app.iconSeed} size={16} /> {p.app.name}
                </Link>
                <span>·</span>
                <span>Published {dateLabel(p.publishedAt, { year: true })}</span>
              </div>
              <h1 className="display mt-4 text-[24px] leading-snug font-semibold text-fg md:text-[28px]">{p.caption || "Untitled post"}</h1>
              <div className="mt-5 flex gap-2">
                <Button variant="secondary" icon={<ExternalLink size={14} />} onClick={() => window.open(p.url, "_blank", "noopener")}>
                  Open on {PLATFORM_META[p.platform].label}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Skeleton className="h-4 w-64" />
              <Skeleton className="mt-5 h-8 w-4/5" />
            </>
          )}

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <Metric label="Views" value={p?.views ?? null} />
            <Metric label="Likes" value={p?.likes ?? null} />
            <Metric label="Comments" value={p?.comments ?? null} />
            <Metric label="Shares" value={p?.shares ?? null} />
            <Metric label="Engagement" value={d?.engagementRate ?? null} format={(n) => rate(n, 2)} hint="(Likes + comments + shares) ÷ views" />
          </div>
          {p && <p className="mt-3 text-[12px] text-fg-3">Lifetime totals · updated {timeAgo(p.lastSyncedAt).toLowerCase()}</p>}

          <section className="mt-12">
            <SectionHeader
              title="Performance since publication"
              description={
                d?.trackingStartedDay && d.trackingStartedDay > 1
                  ? `Tracking began on day ${d.trackingStartedDay}; earlier days are unknown.`
                  : "Cumulative views, day by day"
              }
            />
            <div className="card px-2 pt-4 pb-2 sm:px-3">
              {d ? (
                <TimeChart
                  series={[{ id: "pv", label: "Views", color: "var(--chart-line)", points: tl.map((t) => ({ date: t.date, value: t.views, change: t.gained })) }]}
                  area
                  height={240}
                  valueLabel="Views"
                  emptyLabel="No history recorded for this post yet"
                />
              ) : (
                <Skeleton className="h-[230px] w-full rounded-xl" />
              )}
            </div>

            {shownDays.length > 0 && (
              <div className="mt-6">
                <div className="grid grid-cols-[64px_minmax(0,1fr)_90px_90px] gap-x-4 px-1 pb-2 text-[11.5px] font-medium text-fg-3 hairline-b">
                  <span>Day</span>
                  <span />
                  <span className="text-right">Views</span>
                  <span className="text-right">Gained</span>
                </div>
                {shownDays.map((t) => (
                  <div key={t.day} className="grid grid-cols-[64px_minmax(0,1fr)_90px_90px] items-center gap-x-4 px-1 py-2 text-[13px] hairline-b">
                    <span className="flex items-center gap-1.5 text-fg-2">
                      Day {t.day}
                      {breakout?.day === t.day && <Flame size={13} className="text-warning" aria-label="Biggest day" />}
                    </span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
                      <div className={cn("h-full rounded-full", breakout?.day === t.day ? "bg-accent" : "bg-[color-mix(in_oklab,var(--accent)_45%,transparent)]")} style={{ width: `${maxGain ? Math.max(2, ((t.gained ?? 0) / maxGain) * 100) : 0}%` }} />
                    </div>
                    <span className="text-right font-medium text-fg tnum">{compact(t.views)}</span>
                    <span className={cn("text-right tnum", (t.gained ?? 0) > 0 ? "text-fg-2" : "text-fg-4")}>{t.gained === null ? "—" : signed(t.gained)}</span>
                  </div>
                ))}
                {breakout && (
                  <p className="mt-3 text-[12.5px] text-fg-3">
                    Biggest day: <span className="font-medium text-fg-2">day {breakout.day}</span> with <span className="font-medium text-fg-2 tnum">{full(breakout.gained)}</span> new views.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

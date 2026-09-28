"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, Heart, MessageCircle, Repeat2, Play } from "lucide-react";
import type { PostCard } from "@/lib/types";
import { compact, dateLabel } from "@/lib/format";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

export function Thumb({ post, className, sizes = "card" }: { post: Pick<PostCard, "thumbnailUrl" | "caption" | "platform">; className?: string; sizes?: "card" | "large" }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("overflow-hidden bg-surface-hover", className ?? "relative")}>
      {post.thumbnailUrl && !failed ? (
        <img
          src={post.thumbnailUrl}
          alt={post.caption ?? ""}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.045]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-fg-4">
          <Play size={sizes === "large" ? 32 : 20} strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}

/** Premium vertical content card: the thumbnail dominates, metadata stays quiet. */
export function ContentCard({ post, showPeriod, periodLabel, className }: { post: PostCard; showPeriod?: boolean; periodLabel?: string; className?: string }) {
  return (
    <Link href={`/content/${post.id}`} className={cn("group block outline-none", className)}>
      <div className="relative aspect-[9/16] overflow-hidden rounded-[14px] shadow-[0_0_0_1px_var(--line)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover:-translate-y-0.5 group-hover:shadow-[0_0_0_1px_var(--line),0_14px_30px_-12px_rgba(0,0,0,.28)] group-focus-visible:ring-2 group-focus-visible:ring-[var(--accent)]">
        <Thumb post={post} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        <div className="absolute top-2.5 left-2.5 flex size-6 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md">
          <PlatformIcon platform={post.platform} size={11} />
        </div>
        {showPeriod && post.periodViews !== undefined && post.periodViews !== null && (
          <div className="absolute top-2.5 right-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-[#121211] tnum backdrop-blur-md" title={periodLabel}>
            +{compact(post.periodViews)}
          </div>
        )}
        <div className="absolute inset-x-3 bottom-3 text-white">
          <div className="flex items-center gap-1.5 text-[15px] font-semibold tracking-[-0.01em] tnum drop-shadow-sm">
            <Eye size={14} strokeWidth={2.2} className="opacity-90" />
            {compact(post.views)}
            <span className="font-normal opacity-80">views</span>
          </div>
          <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-hover:grid-rows-[1fr]">
            <div className="overflow-hidden">
              <div className="flex gap-3 pt-1.5 text-[11.5px] opacity-90 tnum">
                <span className="flex items-center gap-1">
                  <Heart size={11} /> {compact(post.likes)}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle size={11} /> {compact(post.comments)}
                </span>
                {post.shares !== null && (
                  <span className="flex items-center gap-1">
                    <Repeat2 size={11} /> {compact(post.shares)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2 px-0.5">
        <Avatar name={post.account.username} url={post.account.avatarUrl} size={18} />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-fg">@{post.account.username}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 px-0.5 text-[12px] text-fg-3">
        <span className="truncate">{post.app.name}</span>
        <span className="shrink-0 tnum">{dateLabel(post.publishedAt)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 px-0.5 text-[11.5px] text-fg-3 tnum">
        <span className="flex items-center gap-1" title="Likes">
          <Heart size={11} className="text-fg-4" />
          {compact(post.likes)}
        </span>
        <span className="flex items-center gap-1" title="Comments">
          <MessageCircle size={11} className="text-fg-4" />
          {compact(post.comments)}
        </span>
        <span className="flex items-center gap-1" title="Shares">
          <Repeat2 size={11} className="text-fg-4" />
          {compact(post.shares)}
        </span>
      </div>
    </Link>
  );
}

export function ContentCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[9/16] w-full rounded-[14px]" />
      <Skeleton className="mt-3 h-3 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </div>
  );
}

"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Clapperboard } from "lucide-react";
import { api } from "@/lib/api";
import type { PostCard } from "@/lib/types";
import { ContentCard, ContentCardSkeleton } from "./content-card";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

type Page = { posts: PostCard[]; total: number; nextCursor: number | null };

/** Paginated 9:16 grid with infinite scroll (IntersectionObserver). */
export function ContentGrid({ query, empty, onTotal }: { query: string; empty?: { title: string; description: string }; onTotal?: (n: number) => void }) {
  const q = useInfiniteQuery({
    queryKey: ["posts", query],
    queryFn: ({ pageParam }) => api<Page>(`/api/v1/posts?${query}${query ? "&" : ""}cursor=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
  });
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
      },
      { rootMargin: "800px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [q]);

  const total = q.data?.pages[0]?.total;
  useEffect(() => {
    if (total !== undefined) onTotal?.(total);
  }, [total, onTotal]);

  const grid = "grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  if (!q.data)
    return (
      <div className={grid}>
        {Array.from({ length: 10 }).map((_, i) => (
          <ContentCardSkeleton key={i} />
        ))}
      </div>
    );
  const posts = q.data.pages.flatMap((p) => p.posts);
  if (!posts.length)
    return (
      <div className="card">
        <EmptyState icon={<Clapperboard size={22} strokeWidth={1.5} />} title={empty?.title ?? "No content yet"} description={empty?.description ?? "Posts appear here once accounts are collected."} />
      </div>
    );
  return (
    <>
      <div className={cn(grid, "transition-opacity", q.isPlaceholderData && "opacity-60")}>
        {posts.map((p) => (
          <ContentCard key={p.id} post={p} />
        ))}
      </div>
      <div ref={sentinel} className="flex h-16 items-center justify-center text-fg-3">
        {q.isFetchingNextPage && <Spinner />}
      </div>
    </>
  );
}

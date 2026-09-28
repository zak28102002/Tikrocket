"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ContentGrid } from "@/components/pulse/content-grid";
import { FilterPill } from "@/components/ui/filter-pill";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { AppIcon, Avatar } from "@/components/ui/avatar";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { useParamState } from "@/hooks/use-range";
import { api } from "@/lib/api";
import { PLATFORM_META, PLATFORMS } from "@/lib/platforms";
import type { AccountRow, AppSummary } from "@/lib/types";

const SORTS = { views: "Most views", likes: "Most likes", comments: "Most comments", shares: "Most shares", newest: "Newest" } as const;
const PUBLISHED = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", "1y": "Last 12 months" } as const;
const PERF = { top10: "Top 10%", above_avg: "Above average" } as const;

export default function ContentPage() {
  const { params, set } = useParamState();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => set({ q: search.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const apps = useQuery({ queryKey: ["apps", "list"], queryFn: () => api<{ apps: AppSummary[] }>("/api/v1/apps?range=7d") });
  const accounts = useQuery({ queryKey: ["accounts", "list"], queryFn: () => api<{ accounts: AccountRow[] }>("/api/v1/accounts?range=7d") });

  const sort = (params.get("sort") as keyof typeof SORTS) ?? "views";
  const query = new URLSearchParams();
  for (const k of ["appId", "platform", "accountId", "published", "performance", "q"]) {
    const v = params.get(k);
    if (v) query.set(k, v);
  }
  query.set("sort", sort);

  return (
    <>
      <PageHeader title="Content" description="See what is driving attention across your apps." showRange={false} />
      <div className="mb-7 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <FilterPill label="App" allLabel="All apps" value={params.get("appId")} onChange={(v) => set({ appId: v })} options={(apps.data?.apps ?? []).map((a) => ({ value: a.id, label: a.name, icon: <AppIcon name={a.name} url={a.iconUrl} seed={a.iconSeed} size={16} /> }))} />
          <FilterPill label="Platform" allLabel="All platforms" value={params.get("platform")} onChange={(v) => set({ platform: v })} options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_META[p].label, icon: <PlatformIcon platform={p} size={13} /> }))} />
          <FilterPill label="Account" allLabel="All accounts" value={params.get("accountId")} onChange={(v) => set({ accountId: v })} options={(accounts.data?.accounts ?? []).map((a) => ({ value: a.id, label: `@${a.username}`, icon: <Avatar name={a.username} url={a.avatarUrl} size={16} /> }))} />
          <FilterPill label="Published" allLabel="Any date" value={params.get("published") as keyof typeof PUBLISHED | null} onChange={(v) => set({ published: v })} options={Object.entries(PUBLISHED).map(([value, label]) => ({ value: value as keyof typeof PUBLISHED, label }))} />
          <FilterPill label="Performance" allLabel="All performance" value={params.get("performance") as keyof typeof PERF | null} onChange={(v) => set({ performance: v })} options={Object.entries(PERF).map(([value, label]) => ({ value: value as keyof typeof PERF, label }))} />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search captions"
              className="h-8 w-full rounded-full bg-surface pr-3 pl-8 text-[12.5px] text-fg shadow-[0_0_0_1px_var(--line-strong)] outline-none placeholder:text-fg-4 focus:shadow-[0_0_0_1px_var(--accent),0_0_0_3px_var(--accent-soft)] lg:w-48"
            />
          </div>
          <Menu>
            <MenuTrigger asChild>
              <button className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium whitespace-nowrap text-fg-2 shadow-[0_0_0_1px_var(--line-strong)] hover:bg-surface-hover">
                <ArrowUpDown size={13} className="text-fg-3" /> {SORTS[sort]}
              </button>
            </MenuTrigger>
            <MenuContent>
              {Object.entries(SORTS).map(([k, label]) => (
                <MenuItem key={k} checked={sort === k} onSelect={() => set({ sort: k === "views" ? null : k })}>
                  {label}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        </div>
      </div>
      {total !== null && <p className="-mt-3 mb-5 text-[12.5px] text-fg-3 tnum">{total.toLocaleString()} posts</p>}
      <ContentGrid query={query.toString()} onTotal={setTotal} empty={{ title: "No content matches", description: "Try removing a filter, or add accounts to collect more posts." }} />
    </>
  );
}

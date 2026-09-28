"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AtSign } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { AccountRow, AccountRowsHeader, AccountRowsSkeleton } from "@/components/pulse/account-rows";
import { FilterPill } from "@/components/ui/filter-pill";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { AppIcon } from "@/components/ui/avatar";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { useParamState, useRange } from "@/hooks/use-range";
import { api } from "@/lib/api";
import { PLATFORM_META, PLATFORMS } from "@/lib/platforms";
import type { AccountRow as Row, AppSummary } from "@/lib/types";
import type { PlatformKey } from "@/lib/profile-url";
import { cn } from "@/lib/cn";

export default function AccountsPage() {
  const { qs } = useRange();
  const { params, set } = useParamState();
  const appId = params.get("appId");
  const platform = params.get("platform") as PlatformKey | null;
  const filters = new URLSearchParams(qs);
  if (appId) filters.set("appId", appId);
  if (platform) filters.set("platform", platform);

  const q = useQuery({
    queryKey: ["accounts", filters.toString()],
    queryFn: () => api<{ accounts: Row[] }>(`/api/v1/accounts?${filters}`),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (query.state.data?.accounts.some((a) => a.status === "PENDING" || a.activeJobId) ? 3000 : false),
  });
  const apps = useQuery({ queryKey: ["apps", qs], queryFn: () => api<{ apps: AppSummary[] }>(`/api/v1/apps?${qs}`) });

  return (
    <>
      <PageHeader title="Accounts" description="Every public profile Pulse is tracking." />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <FilterPill
          label="App"
          allLabel="All apps"
          value={appId}
          onChange={(v) => set({ appId: v })}
          options={(apps.data?.apps ?? []).map((a) => ({ value: a.id, label: a.name, icon: <AppIcon name={a.name} url={a.iconUrl} seed={a.iconSeed} size={16} /> }))}
        />
        <FilterPill
          label="Platform"
          allLabel="All platforms"
          value={platform}
          onChange={(v) => set({ platform: v })}
          options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_META[p].label, icon: <PlatformIcon platform={p} size={13} /> }))}
        />
        {q.data && <span className="ml-auto text-[12.5px] text-fg-3 tnum">{q.data.accounts.length} accounts</span>}
      </div>
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <AccountRowsSkeleton rows={6} />
      ) : q.data.accounts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<AtSign size={22} strokeWidth={1.5} />}
            title={appId || platform ? "No accounts match these filters" : "No social accounts connected"}
            description={appId || platform ? "Try clearing a filter." : "Open an app and add a public profile to start collecting performance data."}
          />
        </div>
      ) : (
        <div className={cn("transition-opacity", q.isPlaceholderData && "opacity-60")}>
          <AccountRowsHeader periodLabel={filters.get("range") ?? ""} />
          {q.data.accounts.map((a) => (
            <AccountRow key={a.id} row={a} />
          ))}
        </div>
      )}
    </>
  );
}

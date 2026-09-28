"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AtSign, ChevronLeft, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import Link from "next/link";
import { PageHeader, SectionHeader } from "@/components/shell/page-header";
import { useModals } from "@/components/shell/modals";
import { MetricChart } from "@/components/pulse/metric-chart";
import { DetailKpis } from "@/components/pulse/detail-kpis";
import { AccountRow, AccountRowsHeader, AccountRowsSkeleton } from "@/components/pulse/account-rows";
import { ContentCard, ContentCardSkeleton } from "@/components/pulse/content-card";
import { BarList } from "@/components/charts/bar-list";
import { AppIcon } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea } from "@/components/ui/input";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useCan } from "@/components/providers";
import { useRange, useRangeHref } from "@/hooks/use-range";
import { api, ApiError } from "@/lib/api";
import { compact } from "@/lib/format";
import { PLATFORM_META } from "@/lib/platforms";
import type { AppDetailResponse } from "@/lib/types";
import { cn } from "@/lib/cn";

function EditAppModal({ open, onOpenChange, app }: { open: boolean; onOpenChange: (o: boolean) => void; app: AppDetailResponse["app"] }) {
  const [name, setName] = useState(app.name);
  const [description, setDescription] = useState(app.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () => api(`/api/v1/apps/${app.id}`, { method: "PATCH", json: { name, description } }),
    onSuccess: () => {
      qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't save."),
  });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Edit app">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="space-y-4 px-6 pt-4">
          <Field label="Name" htmlFor="edit-name">
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </Field>
          <Field label="Description" optional htmlFor="edit-desc">
            <Textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={280} rows={2} />
          </Field>
          {error && <p className="text-[12.5px] text-negative">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2 rounded-b-2xl bg-surface-2 px-6 py-3.5 shadow-[inset_0_1px_0_var(--line)]">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={save.isPending} disabled={!name.trim()}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function AppPage() {
  const { id } = useParams<{ id: string }>();
  const { qs } = useRange();
  const can = useCan();
  const modals = useModals();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const href = useRangeHref();
  const [editing, setEditing] = useState(false);

  const q = useQuery({
    queryKey: ["app", id, qs],
    queryFn: () => api<AppDetailResponse>(`/api/v1/apps/${id}?${qs}`),
    placeholderData: keepPreviousData,
    // Poll gently while any account is still collecting.
    refetchInterval: (query) => (query.state.data?.accounts.some((a) => a.status === "PENDING" || a.status === "SYNCING" || a.activeJobId) ? 3000 : false),
  });
  const d = q.data?.app.id === id ? q.data : undefined;

  if (q.isError && !d) {
    const notFound = q.error instanceof ApiError && q.error.status === 404;
    return (
      <ErrorState
        title={notFound ? "App not found" : "Couldn't load this app"}
        message={notFound ? "It may have been deleted." : "It's usually temporary."}
        onRetry={notFound ? undefined : () => q.refetch()}
      />
    );
  }

  return (
    <>
      <Link href={href("/apps")} className="mb-4 inline-flex items-center gap-1 text-[12.5px] text-fg-3 transition-colors hover:text-fg">
        <ChevronLeft size={14} /> Apps
      </Link>
      <PageHeader
        leading={d ? <AppIcon name={d.app.name} url={d.app.iconUrl} seed={d.app.iconSeed} size={56} /> : <Skeleton className="size-14 rounded-[15px]" />}
        title={d?.app.name ?? <Skeleton className="h-7 w-40" />}
        description={
          d ? (
            <>
              {d.app.description && <span>{d.app.description} · </span>}
              {d.accounts.length} connected {d.accounts.length === 1 ? "account" : "accounts"}
            </>
          ) : (
            <Skeleton className="mt-1 h-3.5 w-56" />
          )
        }
        actions={
          d &&
          can.edit && (
            <>
              <Button variant="primary" icon={<Plus size={14} />} onClick={() => modals.addAccount(d.app.id)}>
                Add account
              </Button>
              <Menu>
                <MenuTrigger asChild>
                  <IconButton label="App settings" variant="secondary">
                    <Settings2 size={15} />
                  </IconButton>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem icon={<Pencil size={14} />} onSelect={() => setEditing(true)}>
                    Edit details
                  </MenuItem>
                  {can.admin && (
                    <>
                      <MenuSeparator />
                      <MenuItem
                        danger
                        icon={<Trash2 size={14} />}
                        onSelect={async () => {
                          if (!confirm(`Delete ${d.app.name}? All of its accounts and history will be removed.`)) return;
                          await api(`/api/v1/apps/${d.app.id}`, { method: "DELETE" });
                          qc.invalidateQueries();
                          toast({ title: `${d.app.name} deleted` });
                          router.push("/apps");
                        }}
                      >
                        Delete app
                      </MenuItem>
                    </>
                  )}
                </MenuContent>
              </Menu>
            </>
          )
        }
      />
      {d && editing && <EditAppModal open={editing} onOpenChange={setEditing} app={d.app} />}

      {d && d.accounts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<AtSign size={22} strokeWidth={1.5} />}
            title="No social accounts connected"
            description="Add a public profile to start collecting performance data."
            action={
              can.edit ? (
                <Button variant="primary" size="lg" icon={<Plus size={15} />} onClick={() => modals.addAccount(d.app.id)}>
                  Add account
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          {d && d.accounts.some((a) => a.status === "UNAVAILABLE") && (
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-soft px-4 py-3 text-[13px]">
              <p className="text-fg-2">
                <span className="font-medium text-warning">
                  {d.accounts.filter((a) => a.status === "UNAVAILABLE").length} of {d.accounts.length} accounts are waiting for a data source.
                </span>{" "}
                Their metrics show as N/A until a{" "}
                {[...new Set(d.accounts.filter((a) => a.status === "UNAVAILABLE").map((a) => PLATFORM_META[a.platform].label))].join(" / ")} source is configured.
              </p>
              {can.admin && (
                <Link href="/settings" className="text-[12.5px] font-medium text-fg hover:underline hover:underline-offset-4">
                  Open settings
                </Link>
              )}
            </div>
          )}
          <div className={cn("transition-opacity", q.isPlaceholderData && "opacity-60")}>
            {d ? <DetailKpis kpis={d.kpis} periodLabel={d.range.label} /> : <Skeleton className="h-20 w-full" />}
          </div>

          <div className="mt-10">
            <MetricChart charts={d?.charts} kpis={d?.kpis} range={d?.range} title="Performance" />
          </div>

          <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-12 lg:grid-cols-[320px_minmax(0,1fr)]">
            <section>
              <SectionHeader title="Performance by platform" description={d ? `Views · ${d.range.label.toLowerCase()}` : " "} />
              {d ? (
                <BarList
                  items={d.platforms.map((p) => ({
                    key: p.platform,
                    label: (
                      <>
                        <PlatformIcon platform={p.platform} size={13} className="text-fg-2" />
                        {PLATFORM_META[p.platform].label}
                      </>
                    ),
                    value: p.views,
                    meta: `${p.accounts} ${p.accounts === 1 ? "account" : "accounts"} · ${compact(p.followers)} followers`,
                  }))}
                />
              ) : (
                <Skeleton className="h-40 w-full" />
              )}
            </section>
            <section className="min-w-0">
              <SectionHeader
                title="Top content"
                description={d ? (d.range.key === "all" ? "Most viewed" : `Most views gained · ${d.range.label.toLowerCase()}`) : " "}
                action={
                  <Link href={href(`/content?appId=${id}`)} className="text-[12.5px] font-medium text-fg-3 hover:text-fg">
                    View all
                  </Link>
                }
              />
              {d ? (
                d.topContent.length ? (
                  <div className="scrollbar-none -mr-4 flex gap-4 overflow-x-auto pr-4 pb-2 sm:-mr-6 sm:pr-6 lg:-mr-10 lg:pr-10">
                    {d.topContent.map((p) => (
                      <ContentCard key={p.id} post={p} showPeriod={d.range.key !== "all"} className="w-[160px] shrink-0" />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-surface-2 px-4 py-10 text-center text-[13px] text-fg-3">No content gained views in this period.</p>
                )
              ) : (
                <div className="flex gap-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="w-[160px]">
                      <ContentCardSkeleton />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="mt-14">
            <SectionHeader title="Connected accounts" description={d ? `Views and growth · ${d.range.label.toLowerCase()}` : " "} />
            <AccountRowsHeader periodLabel={d?.range.label ?? ""} />
            {d ? d.accounts.map((a) => <AccountRow key={a.id} row={a} showApp={false} />) : <AccountRowsSkeleton />}
          </section>
        </>
      )}
    </>
  );
}

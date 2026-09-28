"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Boxes, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { useModals } from "@/components/shell/modals";
import { AppRow, AppRowsHeader, AppRowsSkeleton } from "@/components/pulse/app-rows";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useCan } from "@/components/providers";
import { useRange } from "@/hooks/use-range";
import { api } from "@/lib/api";
import type { AppSummary } from "@/lib/types";

export default function AppsPage() {
  const { qs } = useRange();
  const can = useCan();
  const modals = useModals();
  const q = useQuery({
    queryKey: ["apps", qs],
    queryFn: () => api<{ apps: AppSummary[] }>(`/api/v1/apps?${qs}`),
    placeholderData: keepPreviousData,
  });
  const apps = q.data ? [...q.data.apps].sort((a, b) => (b.views.value ?? -1) - (a.views.value ?? -1)) : null;

  return (
    <>
      <PageHeader
        title="Apps"
        description="Every app in your portfolio and the attention it's earning."
        actions={
          can.edit && (
            <Button variant="primary" icon={<Plus size={14} />} onClick={modals.newApp}>
              New app
            </Button>
          )
        }
      />
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !apps ? (
        <AppRowsSkeleton rows={4} />
      ) : apps.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Boxes size={22} strokeWidth={1.5} />}
            title="No apps yet"
            description="Create your first app to start tracking social performance."
            action={can.edit ? <Button variant="primary" size="lg" icon={<Plus size={15} />} onClick={modals.newApp}>Create your first app</Button> : undefined}
          />
        </div>
      ) : (
        <>
          <AppRowsHeader />
          {apps.map((a) => (
            <AppRow key={a.id} app={a} />
          ))}
        </>
      )}
    </>
  );
}

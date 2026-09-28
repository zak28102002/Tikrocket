"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { JobStatusResponse } from "@/lib/types";
import { useToast } from "@/components/ui/toast";

const done = (s?: JobStatusResponse["status"]) => s !== undefined && s !== "QUEUED" && s !== "RUNNING";

/** Manual refresh with live job tracking. Refreshes all analytics when the job lands. */
export function useRefreshAccount(accountId: string, serverJobId: string | null = null) {
  const [startedJob, setStartedJob] = useState<string | null>(null);
  const jobId = startedJob ?? serverJobId;
  const qc = useQueryClient();
  const toast = useToast();

  const job = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const r = await api<JobStatusResponse>(`/api/v1/jobs/${jobId}`);
      if (done(r.status)) {
        // Side effects live here (not in an effect): they run exactly once per landing.
        qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "job" });
        if (r.status === "FAILED") toast({ tone: "error", title: "Couldn't update this account", description: r.userError ?? undefined });
      }
      return r;
    },
    enabled: Boolean(jobId),
    refetchInterval: (q) => (done(q.state.data?.status) ? false : 1200),
  });

  const refresh = async () => {
    try {
      const r = await api<{ jobId: string }>(`/api/v1/accounts/${accountId}/refresh`, { method: "POST" });
      setStartedJob(r.jobId);
    } catch (e) {
      toast({ tone: "error", title: e instanceof ApiError ? e.message : "Couldn't start the refresh" });
    }
  };
  return { refresh, refreshing: Boolean(jobId) && !done(job.data?.status) };
}

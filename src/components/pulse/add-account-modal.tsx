"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Info, Link2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api";
import { parseProfileUrl } from "@/lib/profile-url";
import { PLATFORM_META, PLATFORMS } from "@/lib/platforms";
import type { JobStatusResponse, ResolveResponse } from "@/lib/types";
import { cn } from "@/lib/cn";

const STEPS = ["Checking profile…", "Finding content…", "Collecting metrics…", "Almost there…"];
const STAGE_INDEX: Record<JobStatusResponse["stage"], number> = {
  QUEUED: 0,
  CHECKING_PROFILE: 0,
  FINDING_CONTENT: 1,
  COLLECTING_METRICS: 2,
  FINALIZING: 3,
  DONE: 4,
};
const MIN_STEP_MS = 850;

type Phase = { kind: "input" } | { kind: "connecting"; jobId: string; accountId: string };

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function AddAccountModal({ appId, onClose }: { appId: string | null; onClose: () => void }) {
  const open = appId !== null;
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "input" });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const qc = useQueryClient();

  const local = useMemo(() => (url.trim() ? parseProfileUrl(url) : null), [url]);
  const debounced = useDebounced(url.trim(), 250);
  const resolve = useQuery({
    queryKey: ["resolve", debounced],
    queryFn: () => api<ResolveResponse>("/api/v1/accounts/resolve", { method: "POST", json: { url: debounced } }),
    enabled: open && Boolean(debounced) && Boolean(local?.ok),
    staleTime: 10_000,
  });
  const server = resolve.data && resolve.data.ok && local?.ok && resolve.data.username === local.profile.username ? resolve.data : null;

  const connect = useMutation({
    mutationFn: () =>
      api<{ accountId: string; jobId: string }>("/api/v1/accounts", { method: "POST", json: { appId, url: url.trim() } }),
    onSuccess: (r) => {
      setPhase({ kind: "connecting", jobId: r.jobId, accountId: r.accountId });
      qc.invalidateQueries();
    },
    onError: (e) => setSubmitError(e instanceof ApiError ? e.message : "Couldn't add this account."),
  });

  const canConnect = local?.ok && !server?.existing && !connect.isPending;
  const busy = phase.kind === "connecting";

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={520} hideClose={busy} title={phase.kind === "input" ? "Add social account" : undefined}>
      <AnimatePresence mode="wait" initial={false}>
        {phase.kind === "input" ? (
          <motion.form
            key="input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            onSubmit={(e) => {
              e.preventDefault();
              if (canConnect) connect.mutate();
            }}
          >
            <div className="px-6 pt-4">
              <div className="relative">
                <Link2 size={18} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fg-3" />
                <input
                  autoFocus
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setSubmitError(null);
                  }}
                  placeholder="https://"
                  spellCheck={false}
                  autoComplete="off"
                  aria-label="Public profile URL"
                  aria-invalid={Boolean(local && !local.ok && url.length > 8)}
                  className="h-14 w-full rounded-xl bg-surface pr-4 pl-12 text-[15px] text-fg shadow-[0_0_0_1px_var(--line-strong)] outline-none transition-shadow placeholder:text-fg-4 focus:shadow-[0_0_0_1px_var(--accent),0_0_0_4px_var(--accent-soft)]"
                />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[12.5px] text-fg-3">
                <span>Public profiles only.</span>
                <span className="flex items-center gap-2.5" aria-label="Supported platforms">
                  {PLATFORMS.map((p) => (
                    <PlatformIcon key={p} platform={p} size={13} className={cn("transition-opacity", local?.ok && local.profile.platform !== p ? "opacity-25" : "opacity-60")} />
                  ))}
                </span>
              </div>

              <div className="mt-4 min-h-[76px]">
                <AnimatePresence mode="wait">
                  {local?.ok ? (
                    <motion.div
                      key={`${local.profile.platform}:${local.profile.username}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
                      transition={{ type: "spring", stiffness: 500, damping: 36 }}
                      className="flex items-center gap-3.5 rounded-xl bg-surface-2 p-3.5 shadow-[0_0_0_1px_var(--line)]"
                    >
                      <span className="flex size-11 items-center justify-center rounded-full bg-surface text-fg shadow-[0_0_0_1px_var(--line)]">
                        <PlatformIcon platform={local.profile.platform} size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-fg-3">{PLATFORM_META[local.profile.platform].label}</p>
                        <p className="truncate text-[15px] font-semibold text-fg">@{local.profile.username}</p>
                      </div>
                      <div className="shrink-0 text-right text-[12px]">
                        {!server && resolve.isFetching ? (
                          <Spinner size={14} className="text-fg-3" />
                        ) : server?.existing ? (
                          <span className="flex items-center gap-1 text-negative">
                            <AlertCircle size={13} /> Already in {server.existing.appName}
                          </span>
                        ) : server && !server.connectorConfigured ? (
                          <span className="flex items-center gap-1 text-warning">
                            <Info size={13} /> Data source not set up
                          </span>
                        ) : server ? (
                          <span className="flex items-center gap-1 text-positive">
                            <Check size={13} /> Ready
                          </span>
                        ) : null}
                      </div>
                    </motion.div>
                  ) : local && !local.ok && url.trim().length > 6 ? (
                    <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 pt-1 text-[13px] text-fg-2">
                      <AlertCircle size={14} className="text-fg-3" />
                      {local.reason}
                    </motion.p>
                  ) : (
                    <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-1 text-[13px] text-fg-3">
                      For example, <span className="text-fg-2">tiktok.com/@catrotapp</span>, <span className="text-fg-2">instagram.com/mealzyapp</span> or{" "}
                      <span className="text-fg-2">youtube.com/@picksy</span>
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              {server && !server.connectorConfigured && !server.existing && (
                <p className="mt-1 text-[12.5px] leading-relaxed text-fg-3">
                  You can still add it. Metrics will show as N/A until an admin configures a {PLATFORM_META[server.platform].label} data source.
                </p>
              )}
              {submitError && <p className="mt-2 text-[12.5px] text-negative">{submitError}</p>}
            </div>
            <div className="mt-6 flex items-center justify-end gap-2 rounded-b-2xl bg-surface-2 px-6 py-3.5 shadow-[inset_0_1px_0_var(--line)]">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={!canConnect} loading={connect.isPending}>
                Connect account
              </Button>
            </div>
          </motion.form>
        ) : (
          <Progress key="progress" jobId={phase.jobId} accountId={phase.accountId} handle={local?.ok ? local.profile : null} onClose={onClose} onAnother={() => { setUrl(""); setPhase({ kind: "input" }); }} />
        )}
      </AnimatePresence>
    </Modal>
  );
}

function Progress({
  jobId,
  accountId,
  handle,
  onClose,
  onAnother,
}: {
  jobId: string;
  accountId: string;
  handle: { platform: keyof typeof PLATFORM_META; username: string } | null;
  onClose: () => void;
  onAnother: () => void;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const [shown, setShown] = useState(0);
  const lastStep = useRef(0);
  useEffect(() => {
    lastStep.current = Date.now();
  }, []);
  const [retrying, setRetrying] = useState<string | null>(null);
  const activeJob = retrying ?? jobId;

  const job = useQuery({
    queryKey: ["job", activeJob],
    queryFn: () => api<JobStatusResponse>(`/api/v1/jobs/${activeJob}`),
    refetchInterval: (q) => (q.state.data && ["SUCCEEDED", "FAILED", "PARTIAL", "CANCELLED"].includes(q.state.data.status) ? false : 600),
  });
  const target = job.data ? (job.data.status === "QUEUED" || job.data.status === "RUNNING" ? STAGE_INDEX[job.data.stage] : 4) : 0;
  const failed = job.data?.status === "FAILED";
  const unavailable = failed && job.data?.accountStatus === "UNAVAILABLE";

  // Advance at most one step per MIN_STEP_MS so the sequence reads calmly.
  useEffect(() => {
    if (shown >= target || (failed && !unavailable)) return;
    const wait = Math.max(0, MIN_STEP_MS - (Date.now() - lastStep.current));
    const t = setTimeout(() => {
      lastStep.current = Date.now();
      setShown((s) => Math.min(target, s + 1));
    }, wait);
    return () => clearTimeout(t);
  }, [shown, target, failed, unavailable]);

  const done = shown >= 4 && !failed;
  useEffect(() => {
    if (done || unavailable) qc.invalidateQueries();
  }, [done, unavailable, qc]);

  if (failed && !unavailable) {
    return (
      <motion.div key="fail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-6 pt-8 pb-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-negative-soft text-negative">
          <AlertCircle size={22} />
        </div>
        <h3 className="mt-4 text-[16px] font-semibold text-fg">Couldn&apos;t connect this account</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] text-fg-3">{job.data?.userError ?? "The platform didn't return the requested data."}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="ghost" onClick={() => { onClose(); router.push(`/accounts/${accountId}`); }}>
            View account
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              const r = await api<{ jobId: string }>(`/api/v1/accounts/${accountId}/refresh`, { method: "POST" });
              setShown(0);
              lastStep.current = Date.now();
              setRetrying(r.jobId);
            }}
          >
            Try again
          </Button>
        </div>
      </motion.div>
    );
  }

  if (done || (unavailable && shown >= 1)) {
    return (
      <motion.div key="done" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="px-6 pt-9 pb-6 text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 20 }}
          className={cn("mx-auto flex size-14 items-center justify-center rounded-full", unavailable ? "bg-warning-soft text-warning" : "bg-positive-soft text-positive")}
        >
          {unavailable ? (
            <Info size={24} />
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <motion.path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.12, ease: "easeOut" }} />
            </svg>
          )}
        </motion.div>
        <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.01em] text-fg">{unavailable ? "Account added" : "Account connected"}</h3>
        <p className="mt-1 text-[13.5px] text-fg-3">
          {handle && (
            <>
              {PLATFORM_META[handle.platform].label} · @{handle.username}
            </>
          )}
          {!unavailable && job.data?.postsFound !== null && job.data?.postsFound !== undefined && <> · {job.data.postsFound} posts found</>}
        </p>
        {unavailable && <p className="mx-auto mt-3 max-w-sm text-[12.5px] leading-relaxed text-fg-3">{job.data?.userError}</p>}
        <div className="mt-7 flex justify-center gap-2">
          <Button variant="ghost" onClick={onAnother}>
            Add another
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div key="steps" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-6 pt-7 pb-7">
      {handle && (
        <div className="mb-6 flex items-center gap-3">
          <span className="relative flex size-10 items-center justify-center rounded-full bg-surface-hover text-fg">
            <PlatformIcon platform={handle.platform} size={16} />
            <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent)]" style={{ animation: "spin 1s linear infinite" }} />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-fg">@{handle.username}</p>
            <p className="text-[12.5px] text-fg-3">Connecting to {PLATFORM_META[handle.platform].label}</p>
          </div>
        </div>
      )}
      <ol className="space-y-3">
        {STEPS.map((label, i) => {
          const state = i < shown ? "done" : i === shown ? "active" : "todo";
          return (
            <li key={label} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full transition-colors duration-300",
                  state === "done" ? "bg-accent text-white" : state === "active" ? "bg-accent-soft text-accent" : "bg-surface-hover text-fg-4",
                )}
              >
                {state === "done" ? (
                  <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 22 }}>
                    <Check size={12} strokeWidth={3} />
                  </motion.span>
                ) : state === "active" ? (
                  <span className="size-1.5 rounded-full bg-current animate-pulse-dot" />
                ) : (
                  <span className="size-1 rounded-full bg-current" />
                )}
              </span>
              <span className={cn("text-[14px] transition-colors duration-300", state === "todo" ? "text-fg-4" : state === "active" ? "text-fg font-medium" : "text-fg-3")}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-6 text-[12px] text-fg-3">You can close this. Collection continues in the background.</p>
      <div className="mt-3 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </motion.div>
  );
}

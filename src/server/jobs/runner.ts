import { hostname } from "node:os";
import { claimJob, recoverStaleJobs, scheduleDueRefreshes } from "./queue";
import { runSyncJob } from "./sync";

export const workerId = () => `${hostname()}:${process.pid}`;

/** Try to claim and run one specific job (used right after enqueue for snappy starts). */
export async function runJobNow(jobId: string) {
  const claimed = await claimJob(workerId(), jobId);
  if (claimed) await runSyncJob(claimed);
}

/**
 * One scheduler tick: queue due refreshes, recover stale locks, then drain up to
 * `maxJobs` jobs within `budgetMs`. Used by the cron endpoint on serverless hosts.
 */
export async function tick({ maxJobs = 5, budgetMs = 50_000 } = {}) {
  const started = Date.now();
  await recoverStaleJobs();
  const scheduled = await scheduleDueRefreshes();
  let ran = 0;
  while (ran < maxJobs && Date.now() - started < budgetMs) {
    const id = await claimJob(workerId());
    if (!id) break;
    await runSyncJob(id);
    ran++;
  }
  return { scheduled, ran };
}

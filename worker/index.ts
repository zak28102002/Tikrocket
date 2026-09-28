/**
 * Pulse background worker. Run alongside the web app (`pnpm worker`).
 * - Claims queued RefreshJobs (FOR UPDATE SKIP LOCKED) with bounded concurrency.
 * - Every minute: schedules due automatic refreshes and recovers stale locks.
 */
import "dotenv/config";
import { claimJob, recoverStaleJobs, scheduleDueRefreshes } from "@/server/jobs/queue";
import { runSyncJob } from "@/server/jobs/sync";
import { workerId } from "@/server/jobs/runner";

const CONCURRENCY = Math.max(1, Math.min(16, Number(process.env.WORKER_CONCURRENCY ?? 3)));
const POLL_MS = 1000;
const SCHEDULE_MS = 60_000;
const id = workerId();

let running = 0;
let stopping = false;

async function pump() {
  while (!stopping && running < CONCURRENCY) {
    const jobId = await claimJob(id).catch((e) => {
      console.error("[worker] claim failed", e.message);
      return null;
    });
    if (!jobId) return;
    running++;
    runSyncJob(jobId)
      .catch((e) => console.error("[worker] job crashed", jobId, e))
      .finally(() => {
        running--;
        void pump();
      });
  }
}

async function schedule() {
  try {
    await recoverStaleJobs();
    const n = await scheduleDueRefreshes();
    if (n) console.log(`[worker] scheduled ${n} refresh${n === 1 ? "" : "es"}`);
  } catch (e) {
    console.error("[worker] schedule failed", (e as Error).message);
  }
}

console.log(`[worker] ${id} started · concurrency ${CONCURRENCY}`);
void schedule();
const scheduleTimer = setInterval(schedule, SCHEDULE_MS);
const pollTimer = setInterval(() => void pump(), POLL_MS);

function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(scheduleTimer);
  clearInterval(pollTimer);
  console.log("[worker] draining…");
  const wait = setInterval(() => {
    if (running === 0) {
      clearInterval(wait);
      process.exit(0);
    }
  }, 250);
  setTimeout(() => process.exit(0), 30_000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

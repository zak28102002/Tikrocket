import { db, Prisma } from "@/server/db";
import type { JobTrigger } from "@/generated/prisma/enums";

/**
 * Postgres-backed job queue on the RefreshJob table.
 * - A partial unique index guarantees ≤ 1 in-flight job per account.
 * - Workers claim with FOR UPDATE SKIP LOCKED, so any number of worker
 *   processes (or the cron endpoint) can run safely side by side.
 */

export async function enqueueRefresh(accountId: string, trigger: JobTrigger) {
  try {
    return await db.refreshJob.create({ data: { accountId, trigger } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await db.refreshJob.findFirst({
        where: { accountId, status: { in: ["QUEUED", "RUNNING"] } },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        // A manual refresh bumps a waiting scheduled job to the front.
        if (existing.status === "QUEUED" && trigger !== "SCHEDULED" && existing.runAfter > new Date()) {
          return db.refreshJob.update({ where: { id: existing.id }, data: { runAfter: new Date() } });
        }
        return existing;
      }
    }
    throw err;
  }
}

/** Claim the next runnable job (optionally a specific one). Returns its id or null. */
export async function claimJob(workerId: string, jobId?: string): Promise<string | null> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE "RefreshJob" SET
      status = 'RUNNING',
      "lockedAt" = now(),
      "lockedBy" = ${workerId},
      attempts = attempts + 1,
      "startedAt" = COALESCE("startedAt", now())
    WHERE id = (
      SELECT id FROM "RefreshJob"
      WHERE status = 'QUEUED' AND "runAfter" <= now()
        ${jobId ? Prisma.sql`AND id = ${jobId}` : Prisma.empty}
      ORDER BY CASE trigger WHEN 'INITIAL' THEN 0 WHEN 'MANUAL' THEN 1 ELSE 2 END, "runAfter"
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`;
  return rows[0]?.id ?? null;
}

/**
 * Queue SCHEDULED jobs for accounts whose refresh is due and push their
 * nextRefreshAt forward by their interval (account override or workspace default).
 */
export async function scheduleDueRefreshes(): Promise<number> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    WITH due AS (
      SELECT a.id, COALESCE(a."refreshMinutes", w."defaultRefreshMinutes") AS minutes
      FROM "SocialAccount" a
      JOIN "Workspace" w ON w.id = a."workspaceId"
      WHERE a."nextRefreshAt" IS NOT NULL
        AND a."nextRefreshAt" <= now()
        AND a.status NOT IN ('PAUSED', 'UNAVAILABLE')
      FOR UPDATE OF a SKIP LOCKED
    ),
    bumped AS (
      UPDATE "SocialAccount" a SET "nextRefreshAt" =
        CASE WHEN due.minutes > 0 THEN now() + make_interval(mins => due.minutes) ELSE NULL END
      FROM due WHERE a.id = due.id
      RETURNING a.id, due.minutes
    )
    INSERT INTO "RefreshJob" (id, "accountId", trigger, status, stage, attempts, "maxAttempts", "runAfter", "createdAt")
    SELECT 'job_' || replace(gen_random_uuid()::text, '-', ''), id, 'SCHEDULED', 'QUEUED', 'QUEUED', 0, 3, now(), now()
    FROM bumped WHERE minutes > 0
    ON CONFLICT DO NOTHING
    RETURNING id`;
  return rows.length;
}

/** Jobs whose worker died mid-run go back to the queue (or fail after max attempts). */
export async function recoverStaleJobs(staleMinutes = 10) {
  const cutoff = new Date(Date.now() - staleMinutes * 60_000);
  await db.refreshJob.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: cutoff }, attempts: { lt: 3 } },
    data: { status: "QUEUED", lockedAt: null, lockedBy: null, stage: "QUEUED" },
  });
  const failed = await db.refreshJob.findMany({
    where: { status: "RUNNING", lockedAt: { lt: cutoff } },
    select: { id: true, accountId: true },
  });
  for (const j of failed) {
    await db.refreshJob.update({
      where: { id: j.id },
      data: { status: "FAILED", finishedAt: new Date(), userError: "This update took too long and was stopped.", devErrorDetail: "stale lock" },
    });
    await db.socialAccount.updateMany({ where: { id: j.accountId, status: "SYNCING" }, data: { status: "ERROR" } });
  }
}

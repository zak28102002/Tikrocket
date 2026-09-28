-- At most one in-flight refresh job per account. Enforces refresh de-duplication
-- at the database level, so concurrent clicks / scheduler ticks cannot double-queue.
CREATE UNIQUE INDEX "RefreshJob_one_inflight_per_account"
  ON "RefreshJob" ("accountId")
  WHERE "status" IN ('QUEUED', 'RUNNING');

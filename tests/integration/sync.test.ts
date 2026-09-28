import { beforeAll, describe, expect, it } from "vitest";

const enabled = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!enabled)("sync pipeline (Postgres)", { timeout: 120_000 }, async () => {
  const { db } = await import("@/server/db");
  const { enqueueRefresh, claimJob, scheduleDueRefreshes } = await import("@/server/jobs/queue");
  const { runSyncJob } = await import("@/server/jobs/sync");

  let demoWs: string, realWs: string, appId: string, realAppId: string;

  beforeAll(async () => {
    await db.workspace.deleteMany({ where: { slug: { in: ["t-demo", "t-real"] } } });
    demoWs = (await db.workspace.create({ data: { name: "T demo", slug: "t-demo", isDemo: true } })).id;
    realWs = (await db.workspace.create({ data: { name: "T real", slug: "t-real" } })).id;
    appId = (await db.app.create({ data: { workspaceId: demoWs, name: "A", slug: "a" } })).id;
    realAppId = (await db.app.create({ data: { workspaceId: realWs, name: "B", slug: "b" } })).id;
  });

  it("collects profile, posts, snapshots and rollup; second run appends history", async () => {
    const acct = await db.socialAccount.create({
      data: { workspaceId: demoWs, appId, platform: "TIKTOK", username: "catrotapp", profileUrl: "https://www.tiktok.com/@catrotapp" },
    });
    const job = await enqueueRefresh(acct.id, "INITIAL");
    // De-duplication: a second enqueue returns the same in-flight job.
    expect((await enqueueRefresh(acct.id, "MANUAL")).id).toBe(job.id);

    expect(await claimJob("test", job.id)).toBe(job.id);
    expect(await claimJob("test", job.id)).toBeNull(); // already claimed
    await runSyncJob(job.id);

    const after = await db.socialAccount.findUniqueOrThrow({ where: { id: acct.id } });
    expect(after.status).toBe("HEALTHY");
    expect(after.viewsSource).toBe("POSTS");
    expect(Number(after.totalViews)).toBeGreaterThan(0);
    const posts = await db.post.count({ where: { accountId: acct.id } });
    expect(posts).toBeGreaterThan(0);
    expect(await db.accountMetricSnapshot.count({ where: { accountId: acct.id } })).toBe(1);
    expect(await db.accountDailyMetric.count({ where: { accountId: acct.id } })).toBe(1);
    expect((await db.refreshJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("SUCCEEDED");

    const job2 = await enqueueRefresh(acct.id, "MANUAL");
    expect(job2.id).not.toBe(job.id);
    await claimJob("test", job2.id);
    await runSyncJob(job2.id);
    expect(await db.accountMetricSnapshot.count({ where: { accountId: acct.id } })).toBe(2); // never overwritten
    expect(await db.accountDailyMetric.count({ where: { accountId: acct.id } })).toBe(1); // same day → one rollup row
    expect(await db.post.count({ where: { accountId: acct.id } })).toBe(posts); // no duplicate posts
  });

  it("maps connector failures to calm errors", async () => {
    const acct = await db.socialAccount.create({
      data: { workspaceId: demoWs, appId, platform: "INSTAGRAM", username: "notfound_x", profileUrl: "https://www.instagram.com/notfound_x/" },
    });
    const job = await enqueueRefresh(acct.id, "INITIAL");
    await claimJob("test", job.id);
    await runSyncJob(job.id);
    const a = await db.socialAccount.findUniqueOrThrow({ where: { id: acct.id } });
    expect(a.status).toBe("ERROR");
    expect(a.userError).toContain("couldn't find");
    expect(a.devErrorDetail).toContain("NOT_FOUND");
    expect(a.followers).toBeNull();
  });

  it("real workspaces never receive mock data: unconfigured → Data unavailable", async () => {
    const acct = await db.socialAccount.create({
      data: { workspaceId: realWs, appId: realAppId, platform: "TIKTOK", username: "catrotapp", profileUrl: "https://www.tiktok.com/@catrotapp" },
    });
    const job = await enqueueRefresh(acct.id, "INITIAL");
    await claimJob("test", job.id);
    await runSyncJob(job.id);
    const a = await db.socialAccount.findUniqueOrThrow({ where: { id: acct.id } });
    expect(a.status).toBe("UNAVAILABLE");
    expect(a.totalViews).toBeNull();
    expect(await db.post.count({ where: { accountId: acct.id } })).toBe(0);
  });

  it("rejects duplicate accounts in a workspace", async () => {
    await expect(
      db.socialAccount.create({ data: { workspaceId: demoWs, appId, platform: "TIKTOK", username: "catrotapp", profileUrl: "x" } }),
    ).rejects.toThrow();
  });

  it("schedules due refreshes once", async () => {
    const acct = await db.socialAccount.findFirstOrThrow({ where: { workspaceId: demoWs, username: "catrotapp" } });
    await db.socialAccount.update({ where: { id: acct.id }, data: { nextRefreshAt: new Date(Date.now() - 1000) } });
    const n1 = await scheduleDueRefreshes();
    const n2 = await scheduleDueRefreshes();
    expect(n1).toBeGreaterThanOrEqual(1);
    expect(n2).toBe(0);
    const updated = await db.socialAccount.findUniqueOrThrow({ where: { id: acct.id } });
    expect(updated.nextRefreshAt!.getTime()).toBeGreaterThan(Date.now());
  });
});

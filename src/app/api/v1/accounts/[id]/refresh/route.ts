import { after } from "next/server";
import { route } from "@/server/http";
import { refreshAccount } from "@/server/services/accounts";
import { runJobNow } from "@/server/jobs/runner";
import { rateLimit } from "@/server/ratelimit";
import { AppError } from "@/server/errors";

export const POST = route<{ id: string }>({ role: "MEMBER" }, async ({ viewer, params }) => {
  if (!rateLimit(`refresh:${viewer.user.id}`, 30, 60_000).ok) {
    throw new AppError(429, "rate_limited", "That's a lot of refreshes. Give it a minute.");
  }
  const res = await refreshAccount(viewer, params.id);
  after(() => runJobNow(res.jobId).catch((e) => console.error("[after] job", e)));
  return res;
});

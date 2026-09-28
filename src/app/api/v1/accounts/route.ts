import { after } from "next/server";
import { body, route } from "@/server/http";
import { platformFrom, rangeFrom, str } from "@/server/params";
import { createAccount, CreateAccountInput, listAccounts } from "@/server/services/accounts";
import { runJobNow } from "@/server/jobs/runner";

export const GET = route({}, async ({ req, viewer }) =>
  listAccounts(viewer, rangeFrom(req), { appId: str(req, "appId"), platform: platformFrom(req) }),
);

export const POST = route({ role: "MEMBER" }, async ({ req, viewer }) => {
  const res = await createAccount(viewer, await body(req, CreateAccountInput));
  // Start immediately; the worker would pick it up too — SKIP LOCKED makes this race-safe.
  after(() => runJobNow(res.jobId).catch((e) => console.error("[after] job", e)));
  return res;
});

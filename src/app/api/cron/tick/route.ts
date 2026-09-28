import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/env";
import { tick } from "@/server/jobs/runner";

export const maxDuration = 60;

/** For hosts without a long-running worker: call every minute with `Authorization: Bearer $CRON_SECRET`. */
async function handle(req: NextRequest) {
  const secret = env().CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const ok = secret.length > 0 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return new NextResponse(null, { status: 401 });
  return NextResponse.json(await tick({ maxJobs: 5, budgetMs: 45_000 }));
}
export const GET = handle;
export const POST = handle;

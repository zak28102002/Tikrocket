import { body, publicRoute } from "@/server/http";
import { acceptInvite, AcceptInviteInput } from "@/server/services/auth";
import { rateLimit } from "@/server/ratelimit";
import { clientIp } from "@/server/params";
import { AppError } from "@/server/errors";

export const POST = publicRoute(async ({ req }) => {
  if (!rateLimit(`invite:${clientIp(req)}`, 10, 15 * 60_000).ok) {
    throw new AppError(429, "rate_limited", "Too many attempts. Please wait a few minutes.");
  }
  await acceptInvite(await body(req, AcceptInviteInput));
  return { ok: true };
});

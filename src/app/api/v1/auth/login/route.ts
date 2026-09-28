import { body, publicRoute } from "@/server/http";
import { login, LoginInput } from "@/server/services/auth";
import { rateLimit } from "@/server/ratelimit";
import { clientIp } from "@/server/params";
import { AppError } from "@/server/errors";

export const POST = publicRoute(async ({ req }) => {
  const input = await body(req, LoginInput);
  const rl = rateLimit(`login:${clientIp(req)}:${input.email}`, 8, 15 * 60_000);
  if (!rl.ok) throw new AppError(429, "rate_limited", "Too many attempts. Please wait a few minutes and try again.");
  await login(input);
  return { ok: true };
});

import { body, publicRoute } from "@/server/http";
import { login, LoginInput } from "@/server/services/auth";
import { isLimited, rateLimit } from "@/server/ratelimit";
import { clientIp } from "@/server/params";
import { AppError } from "@/server/errors";

const LIMIT = 8;
const WINDOW = 15 * 60_000;

export const POST = publicRoute(async ({ req }) => {
  const input = await body(req, LoginInput);
  const key = `login:${clientIp(req)}:${input.email}`;
  if (isLimited(key, LIMIT)) throw new AppError(429, "rate_limited", "Too many attempts. Please wait a few minutes and try again.");
  try {
    await login(input);
  } catch (e) {
    rateLimit(key, LIMIT, WINDOW); // only failed attempts count
    throw e;
  }
  return { ok: true };
});

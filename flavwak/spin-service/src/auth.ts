import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Shopify App Proxy signature check.
 * https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies
 *
 * Every parameter except `signature` is decoded, multi-values are joined with ",",
 * pairs are sorted and concatenated without separators, then HMAC-SHA256'd with the
 * app's client secret. Only Shopify knows that secret, so a valid signature proves
 * the request came through the store's proxy and that `logged_in_customer_id` is real.
 */
export function verifyAppProxySignature(
  rawQuery: string,
  secret: string,
  opts: { now?: number; maxAgeSeconds?: number; shop?: string } = {},
): { ok: true; params: URLSearchParams } | { ok: false; reason: string } {
  const params = new URLSearchParams(rawQuery);
  const signature = params.get("signature");
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return { ok: false, reason: "missing_signature" };

  const grouped = new Map<string, string[]>();
  for (const [k, v] of params) {
    if (k === "signature") continue;
    grouped.set(k, [...(grouped.get(k) ?? []), v]);
  }
  const message = [...grouped].map(([k, vs]) => `${k}=${vs.join(",")}`).sort().join("");
  const expected = createHmac("sha256", secret).update(message).digest();
  const given = Buffer.from(signature, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "bad_signature" };

  if (opts.maxAgeSeconds !== undefined) {
    const ts = Number(params.get("timestamp"));
    const now = opts.now ?? Math.floor(Date.now() / 1000);
    if (!Number.isFinite(ts) || Math.abs(now - ts) > opts.maxAgeSeconds) return { ok: false, reason: "stale_signature" };
  }
  if (opts.shop && params.get("shop")?.toLowerCase() !== opts.shop.toLowerCase()) return { ok: false, reason: "wrong_shop" };

  return { ok: true, params };
}

/**
 * Anonymous visitor ids. App proxies strip cookies, so the server mints an id, signs
 * it, and the theme keeps the token in localStorage and sends it back. The signature
 * stops a browser from picking someone else's id; it cannot stop a person from
 * clearing storage to get a new one — that is limited by the per-IP cap instead.
 */
const TOKEN_PREFIX = "v1";

function tokenSig(id: string, secret: string): string {
  return createHmac("sha256", secret).update(`visitor:${id}`).digest("base64url").slice(0, 32);
}

export function mintVisitorToken(secret: string): { id: string; token: string } {
  const id = randomBytes(16).toString("base64url");
  return { id, token: `${TOKEN_PREFIX}.${id}.${tokenSig(id, secret)}` };
}

export function readVisitorToken(token: unknown, secret: string): string | null {
  if (typeof token !== "string" || token.length > 128) return null;
  const [prefix, id, sig] = token.split(".");
  if (prefix !== TOKEN_PREFIX || !id || !sig || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) return null;
  const expected = Buffer.from(tokenSig(id, secret));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}

/** Keyed hash so raw IPs are never stored. */
export function hashIp(ip: string | null, secret: string): string | null {
  if (!ip) return null;
  return createHmac("sha256", secret).update(`ip:${ip}`).digest("base64url").slice(0, 32);
}

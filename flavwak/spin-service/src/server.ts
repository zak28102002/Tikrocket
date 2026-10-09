import type { IncomingMessage, ServerResponse } from "node:http";
import { hashIp, mintVisitorToken, readVisitorToken, verifyAppProxySignature } from "./auth.ts";
import type { SpinService } from "./spin.ts";

export interface AppOptions {
  service: SpinService;
  proxySecret: string;
  visitorSecret: string;
  shop: string;
  signatureMaxAgeSeconds: number;
  /** Local development only: accept requests without an App Proxy signature. */
  allowUnsigned: boolean;
  /** Proxies between Shopify and this process that append to X-Forwarded-For (Railway: 1). */
  trustedProxyHops: number;
  healthCheck?: () => Promise<void>;
}

type Json = Record<string, unknown>;

function send(res: ServerResponse, status: number, body: Json): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

async function readJson(req: IncomingMessage, limit = 2048): Promise<Json> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error("body_too_large");
    chunks.push(chunk as Buffer);
  }
  if (!size) return {};
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  return parsed && typeof parsed === "object" ? (parsed as Json) : {};
}

function clientIp(req: IncomingMessage, hops: number): string | null {
  const header = req.headers["x-forwarded-for"];
  const list = (Array.isArray(header) ? header.join(",") : header ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!list.length) return req.socket.remoteAddress ?? null;
  return list[Math.max(0, list.length - 1 - hops)] ?? null;
}

export function createHandler(opts: AppOptions) {
  return async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://internal");
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (path === "/health") {
        await opts.healthCheck?.();
        return send(res, 200, { ok: true });
      }

      if (path !== "/proxy/state" && path !== "/proxy/spin") return send(res, 404, { ok: false, error: "not_found" });

      // Only requests that came through the store's App Proxy are accepted.
      let customerId: string | null = null;
      if (!opts.allowUnsigned) {
        const check = verifyAppProxySignature(url.search.slice(1), opts.proxySecret, {
          maxAgeSeconds: opts.signatureMaxAgeSeconds,
          shop: opts.shop,
        });
        if (!check.ok) return send(res, 401, { ok: false, error: check.reason });
        const raw = check.params.get("logged_in_customer_id") ?? "";
        customerId = /^\d{1,20}$/.test(raw) ? raw : null;
      } else {
        const raw = url.searchParams.get("logged_in_customer_id") ?? "";
        customerId = /^\d{1,20}$/.test(raw) ? raw : null;
      }

      if (path === "/proxy/state") {
        if (req.method !== "GET") return send(res, 405, { ok: false, error: "method_not_allowed" });
        let token = url.searchParams.get("visitor");
        let visitorId = readVisitorToken(token, opts.visitorSecret);
        if (!visitorId) ({ id: visitorId, token } = mintVisitorToken(opts.visitorSecret));
        const state = await opts.service.state({ visitorId, customerId });
        return send(res, 200, { ok: true, visitor: token, loggedIn: !!customerId, ...state });
      }

      if (req.method !== "POST") return send(res, 405, { ok: false, error: "method_not_allowed" });
      let body: Json;
      try {
        body = await readJson(req);
      } catch {
        return send(res, 400, { ok: false, error: "bad_request" });
      }
      const visitorId = readVisitorToken(body.visitor, opts.visitorSecret);
      if (!visitorId) return send(res, 400, { ok: false, error: "visitor_required" });

      const out = await opts.service.spin({
        visitorId,
        customerId,
        ipHash: hashIp(clientIp(req, opts.trustedProxyHops), opts.visitorSecret),
      });
      if (out.kind === "rate_limited") return send(res, 429, { ok: false, error: "rate_limited" });
      if (out.kind === "unavailable") return send(res, 503, { ok: false, error: "discount_unavailable", retryable: out.retryable });
      return send(res, 200, { ok: true, alreadySpun: out.alreadySpun, result: out.result });
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "request_failed", path, error: (err as Error).message }));
      if (!res.headersSent) send(res, 500, { ok: false, error: "internal" });
    }
  };
}

import type { PlatformKey } from "@/lib/profile-url";
import { ConnectorError } from "./errors";

/**
 * Per-platform throttle: bounded concurrency plus a minimum spacing between
 * requests, so a burst of refreshes never hammers an upstream API.
 */
class Throttle {
  private active = 0;
  private queue: (() => void)[] = [];
  private last = 0;
  constructor(
    private concurrency: number,
    private minSpacingMs: number,
  ) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) await new Promise<void>((r) => this.queue.push(r));
    this.active++;
    try {
      const wait = this.last + this.minSpacingMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.last = Date.now();
      return await fn();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }
}

const throttles: Partial<Record<PlatformKey, Throttle>> = {};
const throttle = (p: PlatformKey) => (throttles[p] ??= new Throttle(2, 250));

export type HttpResult = { status: number; body: unknown };

/** Throttled JSON fetch with timeout. Never follows into login walls; never retries silently. */
export async function fetchJson(
  platform: PlatformKey,
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<HttpResult> {
  return throttle(platform).run(async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15_000);
    try {
      const res = await fetch(url, {
        ...init,
        signal: ctrl.signal,
        headers: { accept: "application/json", "user-agent": "Pulse/1.0 (+internal analytics)", ...(init.headers ?? {}) },
        redirect: "follow",
        cache: "no-store",
      });
      const text = await res.text();
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = { raw: text.slice(0, 500) };
      }
      return { status: res.status, body };
    } catch (err) {
      const reason = (err as Error).name === "AbortError" ? "request timed out" : (err as Error).message;
      throw new ConnectorError("UPSTREAM", platform, `network: ${reason}`);
    } finally {
      clearTimeout(timer);
    }
  });
}

/** Redact secrets from URLs before they land in logs / error details. */
export const redact = (url: string) =>
  url.replace(/([?&](key|access_token|api_key|token)=)[^&]+/gi, "$1[redacted]");

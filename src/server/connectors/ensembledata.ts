import type { PlatformKey } from "@/lib/profile-url";
import { env } from "@/server/env";
import { ConnectorError } from "./errors";
import { fetchJson, redact } from "./http";

/**
 * Shared client for EnsembleData (https://ensembledata.com), a licensed social
 * data API. Auth is a `token` query parameter; it is redacted from all error detail.
 */
export const ensembleConfigured = () => Boolean(env().ENSEMBLEDATA_TOKEN);

type Obj = Record<string, unknown>;
export const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** Safe deep getter: get(o, "a.b.0.c"). */
export function get(o: unknown, path: string): unknown {
  let cur: unknown = o;
  for (const k of path.split(".")) {
    if (Array.isArray(cur)) cur = cur[Number(k)];
    else if (isObj(cur)) cur = cur[k];
    else return undefined;
  }
  return cur;
}

/** First defined, non-null value among candidate paths. */
export function pick(o: unknown, ...paths: string[]): unknown {
  for (const p of paths) {
    const v = get(o, p);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

export const str = (v: unknown) => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null);

export async function ensembleGet(platform: PlatformKey, path: string, params: Record<string, string | number>): Promise<unknown> {
  const e = env();
  if (!e.ENSEMBLEDATA_TOKEN) throw new ConnectorError("NOT_CONFIGURED", platform, "ENSEMBLEDATA_TOKEN missing");
  const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), token: e.ENSEMBLEDATA_TOKEN });
  const url = `${e.ENSEMBLEDATA_BASE_URL.replace(/\/$/, "")}${path}?${qs}`;
  const { status, body } = await fetchJson(platform, url, { timeoutMs: 45_000 });
  const message = String(pick(body, "detail", "message", "error") ?? "");
  const detail = `${status} ${message.slice(0, 300)} (${redact(url)})`;

  if (status === 200) return isObj(body) && "data" in body ? body.data : body;
  if (status === 404 || /not.?found|doesn.?t exist|no user/i.test(message)) throw new ConnectorError("NOT_FOUND", platform, detail);
  if (/private/i.test(message)) throw new ConnectorError("PRIVATE", platform, detail);
  if (status === 429 || /quota|units|limit/i.test(message)) throw new ConnectorError("RATE_LIMITED", platform, detail);
  if (status === 401 || status === 403 || /token/i.test(message)) throw new ConnectorError("AUTH", platform, detail);
  throw new ConnectorError("UPSTREAM", platform, detail);
}

import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError, forbidden, unauthorized } from "./errors";
import { getViewer, type Viewer } from "./auth/session";
import { hasRole } from "./auth/roles";
import { env } from "./env";
import type { Role } from "@/generated/prisma/enums";

/** JSON serialization that turns BigInt metrics into numbers (safe well beyond any view count). */
export function json(data: unknown, init?: ResponseInit) {
  const body = JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v));
  return new NextResponse(body, {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers ?? {}) },
  });
}

function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    if (err.status >= 500) console.error("[api]", err.code, err.detail ?? err.message);
    return json({ error: { code: err.code, message: err.userMessage } }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return json(
      { error: { code: "invalid_input", message: first?.message ?? "Some fields need attention.", issues: err.issues } },
      { status: 400 },
    );
  }
  console.error("[api] unhandled", err);
  return json(
    { error: { code: "internal", message: "Something went wrong on our side. Please try again." } },
    { status: 500 },
  );
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Same-origin check for state-changing requests (defense in depth on top of SameSite cookies). */
function checkOrigin(req: NextRequest) {
  if (!MUTATING.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients; still need a valid session cookie
  const allowed = new Set([new URL(env().APP_URL).origin, req.nextUrl.origin]);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }
  if (!allowed.has(origin)) throw new AppError(403, "bad_origin", "This request was blocked for your security.");
}

type Ctx<P> = { req: NextRequest; params: P; viewer: Viewer };

/**
 * Wraps an authenticated, workspace-scoped route handler: session, role,
 * origin check, and calm error mapping in one place.
 */
export function route<P = Record<string, string>>(
  opts: { role?: Role },
  fn: (ctx: Ctx<P>) => Promise<unknown>,
) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      checkOrigin(req);
      const viewer = await getViewer();
      if (!viewer) throw unauthorized();
      if (opts.role && !hasRole(viewer.role, opts.role)) throw forbidden();
      const params = (await context?.params) ?? ({} as P);
      const result = await fn({ req, params, viewer });
      return result instanceof Response ? result : json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Unauthenticated handler with the same error mapping (login, setup, invites). */
export function publicRoute<P = Record<string, string>>(
  fn: (ctx: { req: NextRequest; params: P }) => Promise<unknown>,
) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      checkOrigin(req);
      const params = (await context?.params) ?? ({} as P);
      const result = await fn({ req, params });
      return result instanceof Response ? result : json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function body<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  return schema.parse(raw);
}

export function query<T>(req: NextRequest, schema: ZodType<T>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
}

import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { hashToken, newToken } from "./tokens";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "pulse_session";
const SESSION_DAYS = 30;

export type Viewer = {
  sessionId: string;
  user: { id: string; email: string; name: string; avatarUrl: string | null };
  workspace: { id: string; name: string; slug: string; isDemo: boolean; timezone: string; defaultRefreshMinutes: number };
  role: Role;
  workspaces: { id: string; name: string; isDemo: boolean; role: Role }[];
};

export async function createSession(userId: string, workspaceId?: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt, activeWorkspaceId: workspaceId },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().APP_URL.startsWith("https://"),
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Resolves the signed-in viewer (once per request). Returns null when signed out. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          memberships: { include: { workspace: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;

  const memberships = session.user.memberships;
  if (memberships.length === 0) return null;
  const active =
    memberships.find((m) => m.workspaceId === session.activeWorkspaceId) ??
    memberships.find((m) => !m.workspace.isDemo) ??
    memberships[0];

  // Sliding expiry, written at most once an hour.
  if (Date.now() - session.lastSeenAt.getTime() > 3_600_000) {
    await db.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) },
    });
  }

  const w = active.workspace;
  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      avatarUrl: session.user.avatarUrl,
    },
    workspace: {
      id: w.id,
      name: w.name,
      slug: w.slug,
      isDemo: w.isDemo,
      timezone: w.timezone,
      defaultRefreshMinutes: w.defaultRefreshMinutes,
    },
    role: active.role,
    workspaces: memberships.map((m) => ({
      id: m.workspaceId,
      name: m.workspace.name,
      isDemo: m.workspace.isDemo,
      role: m.role,
    })),
  };
});

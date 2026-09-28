import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { env } from "@/server/env";
import type { Viewer } from "@/server/auth/session";
import { hashToken, newToken } from "@/server/auth/tokens";
import { badRequest, conflict, forbidden, notFound } from "@/server/errors";
import { connectorStatus } from "@/server/connectors/registry";

export const WorkspaceInput = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  timezone: z
    .string()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid timezone.")
    .optional(),
  defaultRefreshMinutes: z.union([z.literal(60), z.literal(360), z.literal(720), z.literal(1440), z.literal(0)]).optional(),
});

export async function getSettings(viewer: Viewer) {
  const [ws, members, invites] = await Promise.all([
    db.workspace.findUniqueOrThrow({ where: { id: viewer.workspace.id } }),
    db.membership.findMany({
      where: { workspaceId: viewer.workspace.id },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    }),
    viewer.role === "ADMIN"
      ? db.invitation.findMany({
          where: { workspaceId: viewer.workspace.id, acceptedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);
  return {
    workspace: { id: ws.id, name: ws.name, timezone: ws.timezone, defaultRefreshMinutes: ws.defaultRefreshMinutes, isDemo: ws.isDemo },
    members: members.map((m) => ({ id: m.id, role: m.role, user: m.user, isYou: m.userId === viewer.user.id })),
    invites: invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt.toISOString() })),
    connectors: connectorStatus(ws),
  };
}

export async function updateWorkspace(viewer: Viewer, input: z.infer<typeof WorkspaceInput>) {
  await db.workspace.update({ where: { id: viewer.workspace.id }, data: input });
  if (input.defaultRefreshMinutes !== undefined) {
    const m = input.defaultRefreshMinutes;
    // Re-plan accounts that follow the workspace default.
    await db.$executeRaw`
      UPDATE "SocialAccount" SET "nextRefreshAt" =
        CASE WHEN ${m}::int > 0 THEN COALESCE("lastSyncedAt", now()) + make_interval(mins => ${m}::int) ELSE NULL END
      WHERE "workspaceId" = ${viewer.workspace.id} AND "refreshMinutes" IS NULL AND status NOT IN ('PAUSED')`;
  }
}

export const InviteInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export async function createInvite(viewer: Viewer, input: z.infer<typeof InviteInput>) {
  const existing = await db.membership.findFirst({ where: { workspaceId: viewer.workspace.id, user: { email: input.email } } });
  if (existing) throw conflict("That person is already a member.");
  const token = newToken();
  await db.invitation.create({
    data: {
      workspaceId: viewer.workspace.id,
      email: input.email,
      role: input.role,
      tokenHash: hashToken(token),
      invitedById: viewer.user.id,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    },
  });
  return { link: `${env().APP_URL}/invite/${token}` };
}

export async function revokeInvite(viewer: Viewer, id: string) {
  await db.invitation.deleteMany({ where: { id, workspaceId: viewer.workspace.id } });
}

export async function updateMember(viewer: Viewer, id: string, role: "ADMIN" | "MEMBER" | "VIEWER") {
  const m = await db.membership.findFirst({ where: { id, workspaceId: viewer.workspace.id } });
  if (!m) throw notFound("Member");
  if (m.userId === viewer.user.id) throw badRequest("You can't change your own role.");
  await db.membership.update({ where: { id }, data: { role } });
}

export async function removeMember(viewer: Viewer, id: string) {
  const m = await db.membership.findFirst({ where: { id, workspaceId: viewer.workspace.id } });
  if (!m) throw notFound("Member");
  if (m.userId === viewer.user.id) throw badRequest("You can't remove yourself.");
  await db.membership.delete({ where: { id } });
}

export async function switchWorkspace(viewer: Viewer, workspaceId: string) {
  if (!viewer.workspaces.some((w) => w.id === workspaceId)) throw forbidden();
  await db.session.update({ where: { id: viewer.sessionId }, data: { activeWorkspaceId: workspaceId } });
}

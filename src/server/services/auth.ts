import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { hashToken } from "@/server/auth/tokens";
import { AppError, badRequest } from "@/server/errors";

export const LoginInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").max(200),
});

export const SetupInput = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters.").max(200),
  workspace: z.string().trim().min(1, "Name your workspace.").max(60),
});

export const AcceptInviteInput = z.object({
  token: z.string().min(10).max(200),
  name: z.string().trim().max(80).optional(),
  password: z.string().min(1, "Enter a password.").max(200),
});

// Unknown emails still pay for a real argon2 verify, so timing doesn't reveal accounts.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword("pulse-timing-equalizer"));

export async function login(input: z.infer<typeof LoginInput>) {
  const user = await db.user.findUnique({ where: { email: input.email } });
  const ok = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), input.password);
  if (!user || !ok) throw new AppError(401, "invalid_credentials", "That email and password don't match.");
  await createSession(user.id);
}

/** First-run setup is offered until a real (non-demo) workspace exists. */
export const needsSetup = async () => (await db.workspace.count({ where: { isDemo: false } })) === 0;

export async function setup(input: z.infer<typeof SetupInput>) {
  if (!(await needsSetup())) throw badRequest("Pulse is already set up. Sign in instead.");
  if (await db.user.findUnique({ where: { email: input.email } })) throw badRequest("That email is already registered. Use a different one.");
  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      memberships: {
        create: {
          role: "ADMIN",
          workspace: {
            create: {
              name: input.workspace,
              slug: input.workspace.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace",
              timezone: "UTC",
            },
          },
        },
      },
    },
    include: { memberships: true },
  });
  await createSession(user.id, user.memberships[0].workspaceId);
}

export async function inviteInfo(token: string) {
  const inv = await db.invitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { workspace: true } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) return null;
  const existingUser = await db.user.findUnique({ where: { email: inv.email }, select: { id: true } });
  return { email: inv.email, workspace: inv.workspace.name, role: inv.role, existingUser: Boolean(existingUser) };
}

export async function acceptInvite(input: z.infer<typeof AcceptInviteInput>) {
  const inv = await db.invitation.findUnique({ where: { tokenHash: hashToken(input.token) } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) throw badRequest("This invite link has expired.");
  let user = await db.user.findUnique({ where: { email: inv.email } });
  if (user) {
    if (!(await verifyPassword(user.passwordHash, input.password))) {
      throw new AppError(401, "invalid_credentials", "That password doesn't match your existing account.");
    }
  } else {
    if (!input.name) throw badRequest("Enter your name.");
    if (input.password.length < 10) throw badRequest("Use at least 10 characters for your password.");
    user = await db.user.create({ data: { email: inv.email, name: input.name, passwordHash: await hashPassword(input.password) } });
  }
  await db.$transaction([
    db.membership.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: inv.workspaceId } },
      create: { userId: user.id, workspaceId: inv.workspaceId, role: inv.role },
      update: {},
    }),
    db.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } }),
  ]);
  await createSession(user.id, inv.workspaceId);
}

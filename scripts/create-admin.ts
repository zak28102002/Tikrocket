/**
 * Create an admin (and their workspace if needed) from the command line.
 *   pnpm pulse:create-admin --email you@co.com --name "You" --password "…" --workspace "Acme Apps"
 * Existing users are added as admin to the workspace.
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import { db } from "@/server/db";
import { hashPassword } from "@/server/auth/password";

const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" }, password: { type: "string" }, workspace: { type: "string" } },
});
const email = values.email?.trim().toLowerCase();
if (!email || !values.password || !values.workspace) {
  console.error('Usage: pnpm pulse:create-admin --email <email> --name <name> --password <password> --workspace "<name>"');
  process.exit(1);
}
if (values.password.length < 10) {
  console.error("Password must be at least 10 characters.");
  process.exit(1);
}

const slug = values.workspace.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";
const ws = await db.workspace.upsert({ where: { slug }, create: { name: values.workspace, slug }, update: {} });
const user = await db.user.upsert({
  where: { email },
  create: { email, name: values.name ?? email.split("@")[0], passwordHash: await hashPassword(values.password) },
  update: {},
});
await db.membership.upsert({
  where: { userId_workspaceId: { userId: user.id, workspaceId: ws.id } },
  create: { userId: user.id, workspaceId: ws.id, role: "ADMIN" },
  update: { role: "ADMIN" },
});
console.log(`✓ ${email} is an admin of "${ws.name}"`);
await db.$disconnect();

import { z } from "zod";
import { body, route } from "@/server/http";
import { removeMember, updateMember } from "@/server/services/workspace";

type P = { id: string };
export const PATCH = route<P>({ role: "ADMIN" }, async ({ req, viewer, params }) => {
  const { role } = await body(req, z.object({ role: z.enum(["ADMIN", "MEMBER", "VIEWER"]) }));
  await updateMember(viewer, params.id, role);
  return { ok: true };
});
export const DELETE = route<P>({ role: "ADMIN" }, async ({ viewer, params }) => {
  await removeMember(viewer, params.id);
  return { ok: true };
});

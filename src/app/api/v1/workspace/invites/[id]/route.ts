import { route } from "@/server/http";
import { revokeInvite } from "@/server/services/workspace";

export const DELETE = route<{ id: string }>({ role: "ADMIN" }, async ({ viewer, params }) => {
  await revokeInvite(viewer, params.id);
  return { ok: true };
});

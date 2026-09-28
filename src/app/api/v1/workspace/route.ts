import { body, route } from "@/server/http";
import { getSettings, updateWorkspace, WorkspaceInput } from "@/server/services/workspace";

export const GET = route({}, async ({ viewer }) => getSettings(viewer));
export const PATCH = route({ role: "ADMIN" }, async ({ req, viewer }) => {
  await updateWorkspace(viewer, await body(req, WorkspaceInput));
  return { ok: true };
});

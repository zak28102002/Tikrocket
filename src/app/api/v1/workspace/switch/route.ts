import { z } from "zod";
import { body, route } from "@/server/http";
import { switchWorkspace } from "@/server/services/workspace";

export const POST = route({}, async ({ req, viewer }) => {
  const { workspaceId } = await body(req, z.object({ workspaceId: z.string().min(1) }));
  await switchWorkspace(viewer, workspaceId);
  return { ok: true };
});

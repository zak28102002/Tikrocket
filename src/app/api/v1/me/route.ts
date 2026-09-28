import { route } from "@/server/http";

export const GET = route({}, async ({ viewer }) => ({
  user: viewer.user,
  workspace: viewer.workspace,
  role: viewer.role,
  workspaces: viewer.workspaces,
}));

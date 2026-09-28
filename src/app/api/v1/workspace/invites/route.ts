import { body, route } from "@/server/http";
import { createInvite, InviteInput } from "@/server/services/workspace";

export const POST = route({ role: "ADMIN" }, async ({ req, viewer }) => createInvite(viewer, await body(req, InviteInput)));

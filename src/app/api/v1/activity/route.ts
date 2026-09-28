import { route } from "@/server/http";
import { str } from "@/server/params";
import { listActivity } from "@/server/services/activity";

export const GET = route({}, async ({ req, viewer }) =>
  listActivity(viewer, { cursor: str(req, "cursor"), limit: Number(str(req, "limit") ?? 20) || 20 }),
);

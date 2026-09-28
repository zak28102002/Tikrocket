import { route } from "@/server/http";
import { rangeFrom } from "@/server/params";
import { getOverview } from "@/server/services/overview";

export const GET = route({}, async ({ req, viewer }) => getOverview(viewer, rangeFrom(req)));

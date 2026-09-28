import { body, route } from "@/server/http";
import { rangeFrom } from "@/server/params";
import { AppInput, createApp, listApps } from "@/server/services/apps";

export const GET = route({}, async ({ req, viewer }) => listApps(viewer, rangeFrom(req)));
export const POST = route({ role: "MEMBER" }, async ({ req, viewer }) => ({ app: await createApp(viewer, await body(req, AppInput)) }));

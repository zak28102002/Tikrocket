import { z } from "zod";
import { body, route } from "@/server/http";
import { resolveProfile } from "@/server/services/accounts";

export const POST = route({}, async ({ req, viewer }) => {
  const { url } = await body(req, z.object({ url: z.string().max(500) }));
  return resolveProfile(viewer, url);
});

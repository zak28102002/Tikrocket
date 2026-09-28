import { route } from "@/server/http";
import { str } from "@/server/params";
import { search } from "@/server/services/search";

export const GET = route({}, async ({ req, viewer }) => search(viewer, (str(req, "q") ?? "").slice(0, 80)));

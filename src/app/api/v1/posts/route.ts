import { query, route } from "@/server/http";
import { listPosts, PostQuery } from "@/server/services/posts";

export const GET = route({}, async ({ req, viewer }) => listPosts(viewer, query(req, PostQuery)));

import { route } from "@/server/http";
import { getPostDetail } from "@/server/services/posts";

export const GET = route<{ id: string }>({}, async ({ viewer, params }) => getPostDetail(viewer, params.id));

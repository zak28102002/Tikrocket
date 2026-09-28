import { route } from "@/server/http";
import { getJob } from "@/server/services/accounts";

export const GET = route<{ id: string }>({}, async ({ viewer, params }) => getJob(viewer, params.id));

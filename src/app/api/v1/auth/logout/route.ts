import { publicRoute } from "@/server/http";
import { destroySession } from "@/server/auth/session";

export const POST = publicRoute(async () => {
  await destroySession();
  return { ok: true };
});

import { body, route } from "@/server/http";
import { rangeFrom } from "@/server/params";
import { AppInput, deleteApp, getAppDetail, updateApp } from "@/server/services/apps";

type P = { id: string };
export const GET = route<P>({}, async ({ req, viewer, params }) => getAppDetail(viewer, params.id, rangeFrom(req)));
export const PATCH = route<P>({ role: "MEMBER" }, async ({ req, viewer, params }) => ({
  app: await updateApp(viewer, params.id, await body(req, AppInput.partial())),
}));
export const DELETE = route<P>({ role: "ADMIN" }, async ({ viewer, params }) => {
  await deleteApp(viewer, params.id);
  return { ok: true };
});

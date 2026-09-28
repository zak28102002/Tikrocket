import { body, route } from "@/server/http";
import { rangeFrom } from "@/server/params";
import { deleteAccount, getAccountDetail, updateAccount, UpdateAccountInput } from "@/server/services/accounts";

type P = { id: string };
export const GET = route<P>({}, async ({ req, viewer, params }) => getAccountDetail(viewer, params.id, rangeFrom(req)));
export const PATCH = route<P>({ role: "MEMBER" }, async ({ req, viewer, params }) => {
  await updateAccount(viewer, params.id, await body(req, UpdateAccountInput));
  return { ok: true };
});
export const DELETE = route<P>({ role: "ADMIN" }, async ({ viewer, params }) => {
  await deleteAccount(viewer, params.id);
  return { ok: true };
});

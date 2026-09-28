import { route } from "@/server/http";
import { storeUpload } from "@/server/media";
import { badRequest } from "@/server/errors";

export const POST = route({ role: "MEMBER" }, async ({ req }) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Choose an image to upload.");
  if (file.size > 5 * 1024 * 1024) throw badRequest("That image is larger than 5 MB.");
  try {
    const id = await storeUpload(Buffer.from(await file.arrayBuffer()), "icon");
    return { assetId: id, url: `/api/media/${id}` };
  } catch {
    throw badRequest("That file isn't a supported image. Try PNG, JPG or WebP.");
  }
});

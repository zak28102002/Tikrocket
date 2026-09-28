import { route } from "@/server/http";
import { platformFrom, rangeFrom, str } from "@/server/params";
import { exportCsv } from "@/server/services/export";

export const GET = route({}, async ({ req, viewer }) => {
  const { stream, filename } = await exportCsv(viewer, rangeFrom(req), { appId: str(req, "appId"), platform: platformFrom(req) });
  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
});

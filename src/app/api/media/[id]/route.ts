import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { getViewer } from "@/server/auth/session";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getViewer())) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  const asset = await db.mediaAsset.findUnique({ where: { id }, select: { bytes: true, mime: true, sha256: true } });
  if (!asset) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(asset.bytes), {
    headers: {
      "content-type": asset.mime,
      "cache-control": "private, max-age=31536000, immutable",
      etag: `"${asset.sha256}"`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}

import { createHash } from "node:crypto";
import sharp from "sharp";
import { db } from "./db";
import { env } from "./env";
import { renderMockImage } from "./connectors/mock/images";

/**
 * Media is cached into Postgres (MediaAsset) because platform CDN URLs expire
 * (Instagram's within days). Served by /api/media/[id] with immutable caching.
 * Swap this module for S3/R2 storage without touching callers.
 */
const MAX_BYTES = 6 * 1024 * 1024;

export type ImageKind = "thumbnail" | "avatar" | "icon";
const SIZES: Record<ImageKind, { width: number; height: number; fit: "cover" | "inside" }> = {
  thumbnail: { width: 360, height: 640, fit: "inside" },
  avatar: { width: 160, height: 160, fit: "cover" },
  icon: { width: 256, height: 256, fit: "cover" },
};

async function save(bytes: Buffer, mime: string, width: number | null, height: number | null, sourceUrl: string | null) {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const asset = await db.mediaAsset.upsert({
    where: { sha256 },
    create: { sha256, bytes: new Uint8Array(bytes), mime, width, height, sourceUrl },
    update: {},
    select: { id: true },
  });
  return asset.id;
}

async function normalizeImage(input: Buffer, kind: ImageKind) {
  const s = SIZES[kind];
  const out = await sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: s.width, height: s.height, fit: s.fit, withoutEnlargement: kind === "thumbnail" })
    .webp({ quality: kind === "thumbnail" ? 76 : 82 })
    .toBuffer({ resolveWithObject: true });
  return { bytes: out.data, width: out.info.width, height: out.info.height };
}

/** Download + normalize a remote image. Returns null on any failure: images never fail a sync. */
export async function ingestRemoteImage(url: string | null, kind: ImageKind): Promise<string | null> {
  if (!url) return null;
  try {
    if (url.startsWith("mock:")) {
      if (!env().PULSE_ENABLE_DEMO) return null;
      const img = await renderMockImage(url);
      return img ? save(img.bytes, img.mime, img.width, img.height, null) : null;
    }
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(u, { signal: ctrl.signal, cache: "no-store" }).finally(() => clearTimeout(timer));
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) return null;
    const img = await normalizeImage(buf, kind);
    return save(img.bytes, "image/webp", img.width, img.height, url.slice(0, 1000));
  } catch (err) {
    console.warn("[media] ingest failed", kind, (err as Error).message);
    return null;
  }
}

/** Validate + normalize an uploaded image (app icons). Throws on invalid input. */
export async function storeUpload(buf: Buffer, kind: ImageKind): Promise<string> {
  if (buf.byteLength > MAX_BYTES) throw new Error("too_large");
  const meta = await sharp(buf).metadata();
  if (!meta.format || !["png", "jpeg", "webp", "gif", "svg", "avif"].includes(meta.format)) throw new Error("bad_format");
  const img = await normalizeImage(buf, kind);
  return save(img.bytes, "image/webp", img.width, img.height, null);
}

/**
 * DEMO ONLY — renders abstract artwork for mock thumbnails/avatars so the demo
 * workspace never needs external images. URLs look like `mock:thumb:<seed>`.
 */
import sharp from "sharp";
import { rng } from "./model";

const PALETTES = [
  ["#1b1f3b", "#5b5bd6", "#f3c4fb"],
  ["#0f2027", "#2c5364", "#9be7c4"],
  ["#2b1a12", "#c2410c", "#fcd9b6"],
  ["#111827", "#334155", "#e2e8f0"],
  ["#1a1033", "#7c3aed", "#fbcfe8"],
  ["#0b1d17", "#15803d", "#d9f99d"],
  ["#1c1917", "#a16207", "#fef3c7"],
  ["#0c1a2b", "#0369a1", "#bae6fd"],
  ["#2a0f1a", "#be185d", "#fecdd3"],
  ["#161616", "#525252", "#fafafa"],
];

function thumbSvg(seed: number) {
  const r = rng(seed);
  const [a, b, c] = PALETTES[Math.floor(r() * PALETTES.length)];
  const blobs = Array.from({ length: 4 }, (_, i) => {
    const cx = Math.round(r() * 360);
    const cy = Math.round(r() * 640);
    const rad = Math.round(90 + r() * 180);
    const fill = [b, c, b, a][i];
    return `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${fill}" opacity="${(0.35 + r() * 0.5).toFixed(2)}"/>`;
  }).join("");
  const angle = Math.round(r() * 360);
  // A soft "subject" silhouette gives the frame some depth, like a real vertical video.
  const sx = 120 + r() * 120;
  const sy = 330 + r() * 80;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640" viewBox="0 0 360 640">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle} .5 .5)"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
    <filter id="f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="46"/></filter>
    <linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>
  </defs>
  <rect width="360" height="640" fill="url(#g)"/>
  <g filter="url(#f)">${blobs}</g>
  <ellipse cx="${sx}" cy="${sy + 170}" rx="120" ry="150" fill="${a}" opacity=".55" filter="url(#f)"/>
  <circle cx="${sx}" cy="${sy}" r="58" fill="${c}" opacity=".35" filter="url(#f)"/>
  <rect width="360" height="640" fill="url(#v)"/>
</svg>`;
}

function avatarSvg(seed: number, letter: string) {
  const r = rng(seed);
  const [a, b, c] = PALETTES[Math.floor(r() * PALETTES.length)];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient></defs>
  <rect width="200" height="200" fill="url(#g)"/>
  <circle cx="150" cy="40" r="80" fill="${c}" opacity=".25"/>
  <text x="100" y="128" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="92" font-weight="700" fill="#fff" opacity=".92">${letter}</text>
</svg>`;
}

export async function renderMockImage(url: string): Promise<{ bytes: Buffer; mime: string; width: number; height: number } | null> {
  const [, kind, seedStr, extra] = url.split(":");
  const seed = Number(seedStr);
  if (!Number.isFinite(seed)) return null;
  if (kind === "thumb") {
    const bytes = await sharp(Buffer.from(thumbSvg(seed))).webp({ quality: 74 }).toBuffer();
    return { bytes, mime: "image/webp", width: 360, height: 640 };
  }
  if (kind === "avatar") {
    const letter = (extra ?? "P").slice(0, 1).toUpperCase().replace(/[^A-Z0-9]/, "P");
    const bytes = await sharp(Buffer.from(avatarSvg(seed, letter))).webp({ quality: 80 }).toBuffer();
    return { bytes, mime: "image/webp", width: 200, height: 200 };
  }
  return null;
}

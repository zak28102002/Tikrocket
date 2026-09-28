import type { PlatformKey } from "./profile-url";

export const PLATFORMS: PlatformKey[] = ["TIKTOK", "INSTAGRAM", "YOUTUBE"];

/**
 * Restrained platform identity: a label and a muted hue used only for tiny
 * indicators (dots, glyph tint). Never used as large fills.
 */
export const PLATFORM_META: Record<PlatformKey, { label: string; slug: string; hue: string }> = {
  TIKTOK: { label: "TikTok", slug: "tiktok", hue: "var(--platform-tiktok)" },
  INSTAGRAM: { label: "Instagram", slug: "instagram", hue: "var(--platform-instagram)" },
  YOUTUBE: { label: "YouTube", slug: "youtube", hue: "var(--platform-youtube)" },
};

export const platformFromSlug = (slug: string): PlatformKey | null =>
  (Object.entries(PLATFORM_META).find(([, m]) => m.slug === slug)?.[0] as PlatformKey) ?? null;

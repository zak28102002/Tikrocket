/**
 * Public profile URL parsing. Pure and shared by client (instant detection
 * while typing) and server (authoritative validation).
 */
export type PlatformKey = "TIKTOK" | "INSTAGRAM" | "YOUTUBE";

export type ParsedProfile = {
  platform: PlatformKey;
  /** Normalized handle (lowercase, no "@"), or a YouTube channel id (UC…, case preserved). */
  username: string;
  /** How the handle should be looked up by the connector. */
  lookup: "handle" | "channelId" | "legacyUsername" | "customUrl";
  canonicalUrl: string;
};

export type ParseResult =
  | { ok: true; profile: ParsedProfile }
  | { ok: false; reason: string };

const TIKTOK_HANDLE = /^[a-z0-9._]{2,24}$/i;
const IG_HANDLE = /^[a-z0-9._]{1,30}$/i;
const YT_HANDLE = /^[a-z0-9._-]{3,30}$/i;
const YT_CHANNEL_ID = /^UC[a-zA-Z0-9_-]{22}$/;

const IG_RESERVED = new Set(["p", "reel", "reels", "stories", "explore", "accounts", "direct", "tv", "about", "developer", "legal"]);

export function parseProfileUrl(input: string): ParseResult {
  const raw = input.trim();
  if (!raw) return { ok: false, reason: "Paste a public profile URL." };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, reason: "That doesn't look like a URL." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "That doesn't look like a URL." };
  }

  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, "");
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  // ── TikTok ──
  if (host === "tiktok.com") {
    const first = parts[0] ?? "";
    if (!first.startsWith("@")) {
      return { ok: false, reason: "Use the profile URL, like tiktok.com/@username." };
    }
    const handle = first.slice(1).toLowerCase();
    if (!TIKTOK_HANDLE.test(handle)) return { ok: false, reason: "That TikTok username doesn't look right." };
    return {
      ok: true,
      profile: { platform: "TIKTOK", username: handle, lookup: "handle", canonicalUrl: `https://www.tiktok.com/@${handle}` },
    };
  }
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") {
    return { ok: false, reason: "Short links aren't supported. Open the profile and copy its full URL." };
  }

  // ── Instagram ──
  if (host === "instagram.com" || host === "instagr.am") {
    const handle = (parts[0] ?? "").replace(/^@/, "").toLowerCase();
    if (!handle || IG_RESERVED.has(handle)) {
      return { ok: false, reason: "Use the profile URL, like instagram.com/username." };
    }
    if (!IG_HANDLE.test(handle)) return { ok: false, reason: "That Instagram username doesn't look right." };
    return {
      ok: true,
      profile: { platform: "INSTAGRAM", username: handle, lookup: "handle", canonicalUrl: `https://www.instagram.com/${handle}/` },
    };
  }

  // ── YouTube ──
  if (host === "youtube.com" || host === "music.youtube.com") {
    const first = parts[0] ?? "";
    if (first.startsWith("@")) {
      const handle = first.slice(1).toLowerCase();
      if (!YT_HANDLE.test(handle)) return { ok: false, reason: "That YouTube handle doesn't look right." };
      return {
        ok: true,
        profile: { platform: "YOUTUBE", username: handle, lookup: "handle", canonicalUrl: `https://www.youtube.com/@${handle}` },
      };
    }
    if (first === "channel" && parts[1] && YT_CHANNEL_ID.test(parts[1])) {
      return {
        ok: true,
        profile: { platform: "YOUTUBE", username: parts[1], lookup: "channelId", canonicalUrl: `https://www.youtube.com/channel/${parts[1]}` },
      };
    }
    if (first === "user" && parts[1]) {
      const u = parts[1].toLowerCase();
      return { ok: true, profile: { platform: "YOUTUBE", username: u, lookup: "legacyUsername", canonicalUrl: `https://www.youtube.com/user/${u}` } };
    }
    if (first === "c" && parts[1]) {
      const u = parts[1].toLowerCase();
      return { ok: true, profile: { platform: "YOUTUBE", username: u, lookup: "customUrl", canonicalUrl: `https://www.youtube.com/c/${u}` } };
    }
    if (first === "watch" || first === "shorts" || first === "playlist") {
      return { ok: false, reason: "That's a video link. Paste the channel URL instead." };
    }
    return { ok: false, reason: "Use the channel URL, like youtube.com/@handle." };
  }
  if (host === "youtu.be") return { ok: false, reason: "That's a video link. Paste the channel URL instead." };

  return { ok: false, reason: "Pulse supports TikTok, Instagram and YouTube profiles." };
}

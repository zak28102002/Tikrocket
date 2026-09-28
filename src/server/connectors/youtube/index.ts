import { env } from "@/server/env";
import { ConnectorError } from "../errors";
import { fetchJson, redact } from "../http";
import {
  count,
  type AccountRef,
  type NormalizedPost,
  type NormalizedPostMetrics,
  type NormalizedProfileMetrics,
  type PlatformConnector,
} from "../types";

const API = "https://www.googleapis.com/youtube/v3";

type YtThumbs = Record<string, { url: string; width?: number; height?: number } | undefined>;
type YtChannel = {
  id: string;
  snippet?: { title?: string; description?: string; customUrl?: string; thumbnails?: YtThumbs };
  statistics?: { viewCount?: string; subscriberCount?: string; hiddenSubscriberCount?: boolean; videoCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
};
type YtVideo = {
  id: string;
  snippet?: { title?: string; publishedAt?: string; thumbnails?: YtThumbs };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
};

/** ISO-8601 duration (PT1M3S) → seconds. */
export function parseIsoDuration(d?: string): number | null {
  if (!d) return null;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d);
  if (!m) return null;
  const [, days, h, min, s] = m.map((x) => Number(x ?? 0));
  return days * 86400 + h * 3600 + min * 60 + s;
}

const bestThumb = (t?: YtThumbs) =>
  t?.maxres?.url ?? t?.standard?.url ?? t?.high?.url ?? t?.medium?.url ?? t?.default?.url ?? null;

export function normalizeVideo(v: YtVideo): NormalizedPost {
  return {
    platformPostId: v.id,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    thumbnailUrl: bestThumb(v.snippet?.thumbnails),
    caption: v.snippet?.title ?? null,
    publishedAt: v.snippet?.publishedAt ? new Date(v.snippet.publishedAt) : null,
    durationSec: parseIsoDuration(v.contentDetails?.duration),
    views: count(v.statistics?.viewCount),
    // likeCount is omitted when the creator hides likes → null, not 0.
    likes: count(v.statistics?.likeCount),
    comments: count(v.statistics?.commentCount),
    // The Data API does not expose share counts.
    shares: null,
  };
}

export function normalizeChannelMetrics(c: YtChannel): NormalizedProfileMetrics {
  return {
    followers: c.statistics?.hiddenSubscriberCount ? null : count(c.statistics?.subscriberCount),
    following: null,
    totalLikes: null,
    totalViews: count(c.statistics?.viewCount),
    postCount: count(c.statistics?.videoCount),
  };
}

export class YouTubeConnector implements PlatformConnector {
  readonly id = "youtube-data-api";
  readonly platform = "YOUTUBE" as const;
  readonly label = "YouTube Data API v3";
  readonly capabilities = { postViews: true, shares: false, profileViews: true };

  isConfigured() {
    return Boolean(env().YOUTUBE_API_KEY);
  }

  private async call<T>(path: string, params: Record<string, string>): Promise<T> {
    if (!this.isConfigured()) throw new ConnectorError("NOT_CONFIGURED", "YOUTUBE", "YOUTUBE_API_KEY missing");
    const qs = new URLSearchParams({ ...params, key: env().YOUTUBE_API_KEY });
    const url = `${API}/${path}?${qs}`;
    const { status, body } = await fetchJson("YOUTUBE", url);
    if (status === 200) return body as T;
    const reason = (body as { error?: { errors?: { reason?: string }[]; message?: string } })?.error;
    const r = reason?.errors?.[0]?.reason ?? "";
    const detail = `${status} ${r} ${reason?.message ?? ""} (${redact(url)})`;
    if (status === 403 && /quota|rateLimit/i.test(r)) throw new ConnectorError("RATE_LIMITED", "YOUTUBE", detail);
    if (status === 400 && /keyInvalid|badRequest/i.test(r)) throw new ConnectorError("AUTH", "YOUTUBE", detail);
    if (status === 403) throw new ConnectorError("AUTH", "YOUTUBE", detail);
    if (status === 404) throw new ConnectorError("NOT_FOUND", "YOUTUBE", detail);
    throw new ConnectorError("UPSTREAM", "YOUTUBE", detail);
  }

  private async channel(ref: AccountRef): Promise<YtChannel> {
    const part = "snippet,statistics,contentDetails";
    let params: Record<string, string>;
    if (ref.platformAccountId) params = { part, id: ref.platformAccountId };
    else if (ref.lookup === "channelId") params = { part, id: ref.username };
    else if (ref.lookup === "legacyUsername") params = { part, forUsername: ref.username };
    // Custom /c/ URLs have no direct lookup; most now resolve as handles.
    else params = { part, forHandle: `@${ref.username}` };

    const res = await this.call<{ items?: YtChannel[] }>("channels", params);
    const ch = res.items?.[0];
    if (!ch) throw new ConnectorError("NOT_FOUND", "YOUTUBE", `no channel for ${ref.lookup}=${ref.username}`);
    return ch;
  }

  async getProfile(ref: AccountRef) {
    const ch = await this.channel(ref);
    const uploads = ch.contentDetails?.relatedPlaylists?.uploads;
    const handle = ch.snippet?.customUrl?.replace(/^@/, "").toLowerCase();
    return {
      platform: "YOUTUBE" as const,
      platformAccountId: ch.id,
      username: ref.username,
      displayName: ch.snippet?.title ?? null,
      profileUrl: handle ? `https://www.youtube.com/@${handle}` : ref.canonicalUrl,
      avatarUrl: bestThumb(ch.snippet?.thumbnails),
      bio: ch.snippet?.description || null,
      isVerified: null, // not exposed by the Data API
      ref: { ...ref, platformAccountId: ch.id, hints: { ...(ref.hints ?? {}), ...(uploads ? { uploads } : {}) } },
    };
  }

  async getProfileMetrics(ref: AccountRef) {
    return normalizeChannelMetrics(await this.channel(ref));
  }

  async getPosts(ref: AccountRef, { limit }: { limit: number }) {
    let uploads = ref.hints?.uploads;
    if (!uploads) uploads = (await this.channel(ref)).contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) return [];

    const ids: string[] = [];
    let pageToken: string | undefined;
    while (ids.length < limit) {
      const page = await this.call<{ items?: { contentDetails?: { videoId?: string } }[]; nextPageToken?: string }>(
        "playlistItems",
        { part: "contentDetails", playlistId: uploads, maxResults: "50", ...(pageToken ? { pageToken } : {}) },
      ).catch((e: ConnectorError) => {
        // An empty channel has no uploads playlist yet.
        if (e.code === "NOT_FOUND") return { items: [], nextPageToken: undefined };
        throw e;
      });
      for (const it of page.items ?? []) if (it.contentDetails?.videoId) ids.push(it.contentDetails.videoId);
      pageToken = page.nextPageToken;
      if (!pageToken) break;
    }
    return this.videos(ids.slice(0, limit));
  }

  private async videos(ids: string[]): Promise<NormalizedPost[]> {
    const out: NormalizedPost[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const res = await this.call<{ items?: YtVideo[] }>("videos", {
        part: "snippet,statistics,contentDetails",
        id: ids.slice(i, i + 50).join(","),
      });
      out.push(...(res.items ?? []).map(normalizeVideo));
    }
    return out;
  }

  async getPostMetrics(_ref: AccountRef, ids: string[]): Promise<NormalizedPostMetrics[]> {
    return (await this.videos(ids)).map(({ platformPostId, views, likes, comments, shares }) => ({
      platformPostId,
      views,
      likes,
      comments,
      shares,
    }));
  }
}

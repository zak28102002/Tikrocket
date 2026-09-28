import { env } from "@/server/env";
import { ConnectorError } from "../errors";
import { fetchJson, redact } from "../http";
import {
  count,
  type AccountRef,
  type NormalizedPost,
  type NormalizedPostMetrics,
  type PlatformConnector,
} from "../types";

/**
 * Instagram via the official Graph API "Business Discovery" endpoint.
 * Requires our own IG Business/Creator account id + token. It returns public
 * metadata for other Business/Creator profiles. View/play counts and shares are
 * not exposed for third-party accounts, so they are reported as null (N/A).
 */
type IgMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};
type IgDiscovery = {
  id?: string;
  username?: string;
  name?: string;
  biography?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  media?: { data?: IgMedia[] };
};

export function normalizeMedia(m: IgMedia): NormalizedPost {
  return {
    platformPostId: m.id,
    url: m.permalink ?? `https://www.instagram.com/p/${m.id}/`,
    thumbnailUrl: m.thumbnail_url ?? (m.media_type === "VIDEO" ? null : (m.media_url ?? null)),
    caption: m.caption ?? null,
    publishedAt: m.timestamp ? new Date(m.timestamp) : null,
    durationSec: null,
    views: null,
    likes: count(m.like_count), // omitted when the owner hides like counts
    comments: count(m.comments_count),
    shares: null,
  };
}

export class InstagramConnector implements PlatformConnector {
  readonly id = "instagram-graph-business-discovery";
  readonly platform = "INSTAGRAM" as const;
  readonly label = "Instagram Graph API · Business Discovery";
  readonly capabilities = { postViews: false, shares: false, profileViews: false };

  isConfigured() {
    return Boolean(env().META_IG_BUSINESS_ACCOUNT_ID && env().META_ACCESS_TOKEN);
  }

  private async discover(username: string, mediaLimit: number): Promise<IgDiscovery> {
    if (!this.isConfigured()) throw new ConnectorError("NOT_CONFIGURED", "INSTAGRAM", "META_* env missing");
    const { META_GRAPH_VERSION: v, META_IG_BUSINESS_ACCOUNT_ID: igId, META_ACCESS_TOKEN: token } = env();
    const mediaFields =
      "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count";
    const fields = `business_discovery.username(${username}){id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count${
      mediaLimit > 0 ? `,media.limit(${Math.min(mediaLimit, 100)}){${mediaFields}}` : ""
    }}`;
    const url = `https://graph.facebook.com/${v}/${igId}?${new URLSearchParams({ fields, access_token: token })}`;
    const { status, body } = await fetchJson("INSTAGRAM", url);
    const b = body as { business_discovery?: IgDiscovery; error?: { code?: number; error_subcode?: number; message?: string } };
    if (status === 200 && b.business_discovery) return b.business_discovery;

    const e = b.error ?? {};
    const detail = `${status} code=${e.code} sub=${e.error_subcode} ${e.message ?? ""} (${redact(url)})`;
    if ([4, 17, 32, 613].includes(e.code ?? -1)) throw new ConnectorError("RATE_LIMITED", "INSTAGRAM", detail);
    if (e.code === 190 || e.code === 10 || e.code === 200) throw new ConnectorError("AUTH", "INSTAGRAM", detail);
    if (e.error_subcode === 2207013) throw new ConnectorError("UNSUPPORTED_ACCOUNT", "INSTAGRAM", detail);
    if (e.code === 110 || e.code === 100) throw new ConnectorError("NOT_FOUND", "INSTAGRAM", detail);
    throw new ConnectorError("UPSTREAM", "INSTAGRAM", detail);
  }

  async getProfile(ref: AccountRef) {
    const d = await this.discover(ref.username, 0);
    return {
      platform: "INSTAGRAM" as const,
      platformAccountId: d.id ?? null,
      username: ref.username,
      displayName: d.name ?? null,
      profileUrl: ref.canonicalUrl,
      avatarUrl: d.profile_picture_url ?? null,
      bio: d.biography ?? null,
      isVerified: null,
      ref: { ...ref, platformAccountId: d.id ?? null },
    };
  }

  async getProfileMetrics(ref: AccountRef) {
    const d = await this.discover(ref.username, 0);
    return {
      followers: count(d.followers_count),
      following: count(d.follows_count),
      totalLikes: null,
      totalViews: null,
      postCount: count(d.media_count),
    };
  }

  async getPosts(ref: AccountRef, { limit }: { limit: number }) {
    const d = await this.discover(ref.username, limit);
    return (d.media?.data ?? []).map(normalizeMedia);
  }

  /** Business Discovery can't look media up by id; refresh from the recent window. */
  async getPostMetrics(ref: AccountRef, ids: string[]): Promise<NormalizedPostMetrics[]> {
    const wanted = new Set(ids);
    const d = await this.discover(ref.username, 100);
    return (d.media?.data ?? [])
      .filter((m) => wanted.has(m.id))
      .map((m) => {
        const n = normalizeMedia(m);
        return { platformPostId: n.platformPostId, views: n.views, likes: n.likes, comments: n.comments, shares: n.shares };
      });
  }
}

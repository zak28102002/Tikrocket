import { ConnectorError } from "../errors";
import { ensembleConfigured, ensembleGet, get, isObj, pick, str } from "../ensembledata";
import { count, type AccountRef, type NormalizedPost, type NormalizedPostMetrics, type PlatformConnector } from "../types";
import { depthFor } from "../tiktok/providers/ensembledata";

/**
 * Instagram via EnsembleData (opt-in with INSTAGRAM_PROVIDER=ensembledata).
 * Unlike Meta's Business Discovery, this returns reel play counts, and works for
 * any public profile (not only Business/Creator).
 *   GET /instagram/user/info?username=
 *   GET /instagram/user/reels?user_id=&depth=
 */
export function normalizeIgUser(data: unknown) {
  const u = pick(data, "user", "data.user") ?? data;
  const username = str(pick(u, "username"));
  if (!username) throw new ConnectorError("NOT_FOUND", "INSTAGRAM", "no username in user info");
  return {
    privateAccount: Boolean(pick(u, "is_private")),
    profile: {
      platformAccountId: str(pick(u, "pk", "id", "pk_id")),
      username: username.toLowerCase(),
      displayName: str(pick(u, "full_name")),
      profileUrl: `https://www.instagram.com/${username.toLowerCase()}/`,
      avatarUrl: str(pick(u, "hd_profile_pic_url_info.url", "profile_pic_url_hd", "profile_pic_url")),
      bio: str(pick(u, "biography")),
      isVerified: typeof pick(u, "is_verified") === "boolean" ? (pick(u, "is_verified") as boolean) : null,
    },
    metrics: {
      followers: count(pick(u, "follower_count", "edge_followed_by.count")),
      following: count(pick(u, "following_count", "edge_follow.count")),
      totalLikes: null,
      totalViews: null,
      postCount: count(pick(u, "media_count", "edge_owner_to_timeline_media.count")),
    },
  };
}

export function normalizeIgMedia(data: unknown): NormalizedPost[] {
  const list = [data, get(data, "reels"), get(data, "posts"), get(data, "items"), get(data, "data")].find(Array.isArray) as unknown[] | undefined;
  const seen = new Set<string>();
  const out: NormalizedPost[] = [];
  for (const wrap of list ?? []) {
    const m = pick(wrap, "media", "node") ?? wrap;
    if (!isObj(m)) continue;
    const id = str(pick(m, "pk", "id"));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const code = str(pick(m, "code", "shortcode"));
    const taken = count(pick(m, "taken_at", "taken_at_timestamp"));
    const dur = pick(m, "video_duration");
    out.push({
      platformPostId: id,
      url: code ? `https://www.instagram.com/reel/${code}/` : `https://www.instagram.com/p/${id}/`,
      thumbnailUrl: str(pick(m, "image_versions2.candidates.0.url", "display_url", "thumbnail_src", "thumbnail_url")),
      caption: str(pick(m, "caption.text", "edge_media_to_caption.edges.0.node.text")),
      publishedAt: taken ? new Date(taken * 1000) : null,
      durationSec: typeof dur === "number" ? Math.round(dur) : null,
      views: count(pick(m, "play_count", "ig_play_count", "view_count", "video_view_count", "video_play_count")),
      likes: count(pick(m, "like_count", "edge_liked_by.count", "edge_media_preview_like.count")),
      comments: count(pick(m, "comment_count", "edge_media_to_comment.count")),
      shares: count(pick(m, "reshare_count", "share_count")),
    });
  }
  return out;
}

export class InstagramEnsembleConnector implements PlatformConnector {
  readonly id = "instagram-ensembledata";
  readonly platform = "INSTAGRAM" as const;
  readonly label = "EnsembleData";
  readonly capabilities = { postViews: true, shares: false, profileViews: false };

  isConfigured() {
    return ensembleConfigured();
  }

  private async info(ref: AccountRef) {
    const n = normalizeIgUser(await ensembleGet("INSTAGRAM", "/instagram/user/info", { username: ref.username }));
    if (n.privateAccount) throw new ConnectorError("PRIVATE", "INSTAGRAM", "account is private");
    return n;
  }

  async getProfile(ref: AccountRef) {
    const n = await this.info(ref);
    return { platform: "INSTAGRAM" as const, ...n.profile, ref: { ...ref, platformAccountId: n.profile.platformAccountId } };
  }

  async getProfileMetrics(ref: AccountRef) {
    return (await this.info(ref)).metrics;
  }

  async getPosts(ref: AccountRef, { limit }: { limit: number }) {
    const userId = ref.platformAccountId ?? (await this.info(ref)).profile.platformAccountId;
    if (!userId) throw new ConnectorError("NOT_FOUND", "INSTAGRAM", "no user id to fetch reels");
    const data = await ensembleGet("INSTAGRAM", "/instagram/user/reels", { user_id: userId, depth: depthFor(limit) });
    return normalizeIgMedia(data).slice(0, Math.max(limit, 10));
  }

  async getPostMetrics(ref: AccountRef, ids: string[]): Promise<NormalizedPostMetrics[]> {
    const wanted = new Set(ids);
    const posts = await this.getPosts(ref, { limit: Math.min(100, Math.max(ids.length, 30)) });
    return posts
      .filter((p) => wanted.has(p.platformPostId))
      .map(({ platformPostId, views, likes, comments, shares }) => ({ platformPostId, views, likes, comments, shares }));
  }
}

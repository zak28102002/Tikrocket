import { ConnectorError } from "../../errors";
import { count, type NormalizedPost } from "../../types";
import { ensembleGet, get, isObj, pick, str } from "../../ensembledata";
import type { TikTokDataProvider } from "../provider";

/**
 * TikTok via EnsembleData.
 *   GET /tt/user/info?username=      → { user, stats? }
 *   GET /tt/user/posts?username=&depth=N  → posts (10 per depth unit)
 * Responses come in TikTok's mobile (snake_case) or web (camelCase) shape; both
 * are accepted. Missing numbers stay null — never 0.
 */
const MAX_DEPTH = 10;

export function normalizeTikTokUser(data: unknown) {
  const user = pick(data, "user", "userInfo.user") ?? data;
  const stats = pick(data, "stats", "userInfo.stats") ?? user;
  const username = str(pick(user, "unique_id", "uniqueId"));
  if (!username) throw new ConnectorError("NOT_FOUND", "TIKTOK", "no unique_id in user info");
  const privateAccount = Boolean(pick(user, "secret", "privateAccount", "is_private"));
  const verified = pick(user, "verified", "is_verified");
  const vType = count(pick(user, "verification_type"));
  const customVerify = str(pick(user, "custom_verify"));
  return {
    privateAccount,
    profile: {
      platformAccountId: str(pick(user, "uid", "id")),
      username: username.toLowerCase(),
      displayName: str(pick(user, "nickname")),
      profileUrl: `https://www.tiktok.com/@${username.toLowerCase()}`,
      avatarUrl: str(
        pick(user, "avatar_larger.url_list.0", "avatar_medium.url_list.0", "avatar_thumb.url_list.0", "avatarLarger", "avatarMedium", "avatarThumb"),
      ),
      bio: str(pick(user, "signature")),
      isVerified: typeof verified === "boolean" ? verified : vType !== null ? vType > 0 || Boolean(customVerify) : null,
    },
    metrics: {
      followers: count(pick(stats, "follower_count", "followerCount")),
      following: count(pick(stats, "following_count", "followingCount")),
      totalLikes: count(pick(stats, "total_favorited", "heartCount", "heart")),
      totalViews: null, // TikTok does not publish lifetime profile views
      postCount: count(pick(stats, "aweme_count", "videoCount")),
    },
  };
}

export function normalizeTikTokPosts(data: unknown, handle: string): NormalizedPost[] {
  const list = [data, get(data, "data"), get(data, "aweme_list"), get(data, "itemList"), get(data, "posts")].find(Array.isArray) as unknown[] | undefined;
  const seen = new Set<string>();
  const out: NormalizedPost[] = [];
  for (const raw of list ?? []) {
    if (!isObj(raw)) continue;
    const id = str(pick(raw, "aweme_id", "id"));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const created = count(pick(raw, "create_time", "createTime"));
    const durMs = count(pick(raw, "video.duration"));
    out.push({
      platformPostId: id,
      url: str(pick(raw, "share_url")) ?? `https://www.tiktok.com/@${handle}/video/${id}`,
      thumbnailUrl: str(pick(raw, "video.origin_cover.url_list.0", "video.cover.url_list.0", "video.dynamic_cover.url_list.0", "video.originCover", "video.cover")),
      caption: str(pick(raw, "desc")),
      publishedAt: created ? new Date(created * 1000) : null,
      // Mobile shape reports milliseconds, web shape seconds.
      durationSec: durMs === null ? null : durMs > 1000 ? Math.round(durMs / 1000) : durMs,
      views: count(pick(raw, "statistics.play_count", "stats.playCount")),
      likes: count(pick(raw, "statistics.digg_count", "stats.diggCount")),
      comments: count(pick(raw, "statistics.comment_count", "stats.commentCount")),
      shares: count(pick(raw, "statistics.share_count", "stats.shareCount")),
    });
  }
  return out;
}

export const depthFor = (limit: number) => Math.max(1, Math.min(MAX_DEPTH, Math.ceil(limit / 10)));

export class EnsembleDataTikTokProvider implements TikTokDataProvider {
  readonly id = "ensembledata";
  readonly label = "EnsembleData";

  async fetchProfile(handle: string) {
    const n = normalizeTikTokUser(await ensembleGet("TIKTOK", "/tt/user/info", { username: handle }));
    if (n.privateAccount) throw new ConnectorError("PRIVATE", "TIKTOK", "account is private");
    return { profile: n.profile, metrics: n.metrics };
  }

  async fetchVideos(handle: string, limit: number) {
    const data = await ensembleGet("TIKTOK", "/tt/user/posts", { username: handle, depth: depthFor(limit) });
    return normalizeTikTokPosts(data, handle).slice(0, Math.max(limit, 10));
  }
}

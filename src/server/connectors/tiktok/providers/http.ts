import { z } from "zod";
import { ConnectorError } from "../../errors";
import { fetchJson } from "../../http";
import { count } from "../../types";
import type { TikTokDataProvider } from "../provider";

/**
 * Generic JSON provider adapter. Point TIKTOK_PROVIDER_BASE_URL at any licensed
 * data API (or a thin proxy in front of one) that implements this contract:
 *
 *   GET {base}/tiktok/profile?username=<handle>
 *     → { user: { id, uniqueId, nickname?, avatar?, signature?, verified?, private? },
 *         stats: { followerCount?, followingCount?, heartCount?, videoCount? } }
 *   GET {base}/tiktok/videos?username=<handle>&limit=<n>
 *     → { videos: [{ id, desc?, createTime? (unix s), cover?, duration?,
 *                    stats: { playCount?, diggCount?, commentCount?, shareCount? } }] }
 *
 * Auth: `Authorization: Bearer ${TIKTOK_PROVIDER_API_KEY}`. Missing fields → N/A.
 * Errors: 404 → not found, 403 with {error:"private"} → private, 429 → rate limited.
 */
const num = z.union([z.number(), z.string()]).nullish();

const ProfileRes = z.object({
  user: z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    uniqueId: z.string(),
    nickname: z.string().nullish(),
    avatar: z.string().nullish(),
    signature: z.string().nullish(),
    verified: z.boolean().nullish(),
    private: z.boolean().nullish(),
  }),
  stats: z
    .object({ followerCount: num, followingCount: num, heartCount: num, videoCount: num })
    .partial()
    .default({}),
});

const VideosRes = z.object({
  videos: z.array(
    z.object({
      id: z.union([z.string(), z.number()]).transform(String),
      desc: z.string().nullish(),
      createTime: num,
      cover: z.string().nullish(),
      duration: num,
      stats: z.object({ playCount: num, diggCount: num, commentCount: num, shareCount: num }).partial().default({}),
    }),
  ),
});

export class HttpTikTokProvider implements TikTokDataProvider {
  readonly id = "http";
  readonly label = "Licensed data provider (HTTP)";
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  private async get(path: string, params: Record<string, string>) {
    const url = `${this.baseUrl.replace(/\/$/, "")}${path}?${new URLSearchParams(params)}`;
    const { status, body } = await fetchJson("TIKTOK", url, { headers: { authorization: `Bearer ${this.apiKey}` } });
    const detail = `${status} ${JSON.stringify(body)?.slice(0, 300)} (${path})`;
    if (status === 200) return body;
    if (status === 404) throw new ConnectorError("NOT_FOUND", "TIKTOK", detail);
    if (status === 403 && (body as { error?: string })?.error === "private") throw new ConnectorError("PRIVATE", "TIKTOK", detail);
    if (status === 401 || status === 403) throw new ConnectorError("AUTH", "TIKTOK", detail);
    if (status === 429) throw new ConnectorError("RATE_LIMITED", "TIKTOK", detail);
    throw new ConnectorError("UPSTREAM", "TIKTOK", detail);
  }

  async fetchProfile(handle: string) {
    const parsed = ProfileRes.safeParse(await this.get("/tiktok/profile", { username: handle }));
    if (!parsed.success) throw new ConnectorError("UPSTREAM", "TIKTOK", `unexpected profile shape: ${parsed.error.message}`);
    const { user, stats } = parsed.data;
    if (user.private) throw new ConnectorError("PRIVATE", "TIKTOK", "provider reports private account");
    return {
      profile: {
        platformAccountId: user.id,
        username: user.uniqueId.toLowerCase(),
        displayName: user.nickname ?? null,
        profileUrl: `https://www.tiktok.com/@${user.uniqueId.toLowerCase()}`,
        avatarUrl: user.avatar ?? null,
        bio: user.signature ?? null,
        isVerified: user.verified ?? null,
      },
      metrics: {
        followers: count(stats.followerCount),
        following: count(stats.followingCount),
        totalLikes: count(stats.heartCount),
        totalViews: null, // TikTok does not publish lifetime profile views
        postCount: count(stats.videoCount),
      },
    };
  }

  async fetchVideos(handle: string, limit: number) {
    const parsed = VideosRes.safeParse(await this.get("/tiktok/videos", { username: handle, limit: String(limit) }));
    if (!parsed.success) throw new ConnectorError("UPSTREAM", "TIKTOK", `unexpected videos shape: ${parsed.error.message}`);
    return parsed.data.videos.map((v) => {
      const ts = count(v.createTime);
      return {
        platformPostId: v.id,
        url: `https://www.tiktok.com/@${handle}/video/${v.id}`,
        thumbnailUrl: v.cover ?? null,
        caption: v.desc ?? null,
        publishedAt: ts ? new Date(ts * 1000) : null,
        durationSec: count(v.duration),
        views: count(v.stats.playCount),
        likes: count(v.stats.diggCount),
        comments: count(v.stats.commentCount),
        shares: count(v.stats.shareCount),
      };
    });
  }
}

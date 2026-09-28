import { env } from "@/server/env";
import { ConnectorError } from "../errors";
import type { AccountRef, NormalizedPostMetrics, PlatformConnector } from "../types";
import type { TikTokDataProvider } from "./provider";
import { HttpTikTokProvider } from "./providers/http";

function resolveProvider(): TikTokDataProvider | null {
  const e = env();
  switch (e.TIKTOK_PROVIDER) {
    case "http":
      return e.TIKTOK_PROVIDER_BASE_URL && e.TIKTOK_PROVIDER_API_KEY
        ? new HttpTikTokProvider(e.TIKTOK_PROVIDER_BASE_URL, e.TIKTOK_PROVIDER_API_KEY)
        : null;
    default:
      return null;
  }
}

/**
 * TikTok has no official API that returns another profile's metrics from a URL,
 * so data comes from a pluggable licensed provider. With none configured the
 * connector reports NOT_CONFIGURED and Pulse shows "Data unavailable".
 */
export class TikTokConnector implements PlatformConnector {
  readonly platform = "TIKTOK" as const;
  readonly capabilities = { postViews: true, shares: true, profileViews: false };
  private provider = resolveProvider();

  get id() {
    return `tiktok-${this.provider?.id ?? "unconfigured"}`;
  }
  get label() {
    return this.provider?.label ?? "Licensed data provider";
  }
  isConfigured() {
    return this.provider !== null;
  }

  private p(): TikTokDataProvider {
    if (!this.provider) throw new ConnectorError("NOT_CONFIGURED", "TIKTOK", "TIKTOK_PROVIDER not configured");
    return this.provider;
  }

  async getProfile(ref: AccountRef) {
    const { profile } = await this.p().fetchProfile(ref.username);
    return { platform: "TIKTOK" as const, ...profile, ref: { ...ref, platformAccountId: profile.platformAccountId } };
  }

  async getProfileMetrics(ref: AccountRef) {
    return (await this.p().fetchProfile(ref.username)).metrics;
  }

  getPosts(ref: AccountRef, { limit }: { limit: number }) {
    return this.p().fetchVideos(ref.username, limit);
  }

  async getPostMetrics(ref: AccountRef, ids: string[]): Promise<NormalizedPostMetrics[]> {
    const wanted = new Set(ids);
    const videos = await this.p().fetchVideos(ref.username, Math.max(ids.length, 60));
    return videos
      .filter((v) => wanted.has(v.platformPostId))
      .map(({ platformPostId, views, likes, comments, shares }) => ({ platformPostId, views, likes, comments, shares }));
  }
}

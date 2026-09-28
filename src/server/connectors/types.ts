import type { ParsedProfile, PlatformKey } from "@/lib/profile-url";

/**
 * The only shapes the rest of Pulse ever sees. Every metric is `number | null`:
 * null means the platform/provider does not expose it. Never substitute 0.
 */
export type NormalizedProfile = {
  platform: PlatformKey;
  platformAccountId: string | null;
  username: string;
  displayName: string | null;
  profileUrl: string;
  avatarUrl: string | null;
  bio: string | null;
  isVerified: boolean | null;
};

export type NormalizedProfileMetrics = {
  followers: number | null;
  following: number | null;
  totalLikes: number | null;
  /** Lifetime profile views where the platform exposes them (YouTube). */
  totalViews: number | null;
  postCount: number | null;
};

export type NormalizedPostMetrics = {
  platformPostId: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
};

export type NormalizedPost = NormalizedPostMetrics & {
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  publishedAt: Date | null;
  durationSec: number | null;
};

/** A resolved account reference that connectors can pass between calls. */
export type AccountRef = ParsedProfile & {
  platformAccountId?: string | null;
  /** Connector-private hints (e.g. YouTube uploads playlist id). */
  hints?: Record<string, string>;
};

export interface PlatformConnector {
  /** Stable id stored on the account, e.g. "youtube-data-api". */
  readonly id: string;
  readonly platform: PlatformKey;
  /** Human label for settings, e.g. "YouTube Data API v3". */
  readonly label: string;
  /** Whether the metric set includes post views (drives UI copy). */
  readonly capabilities: { postViews: boolean; shares: boolean; profileViews: boolean };
  isConfigured(): boolean;
  getProfile(ref: AccountRef): Promise<NormalizedProfile & { ref: AccountRef }>;
  getProfileMetrics(ref: AccountRef): Promise<NormalizedProfileMetrics>;
  getPosts(ref: AccountRef, opts: { limit: number }): Promise<NormalizedPost[]>;
  getPostMetrics(ref: AccountRef, platformPostIds: string[]): Promise<NormalizedPostMetrics[]>;
}

/** Parse a count that may be a string/number/absent into number | null. */
export function count(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

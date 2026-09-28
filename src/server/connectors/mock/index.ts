/**
 * DEMO ONLY. Registered when PULSE_ENABLE_DEMO=true and used exclusively for
 * workspaces flagged `isDemo`. The registry refuses to hand it to real workspaces.
 */
import type { PlatformKey } from "@/lib/profile-url";
import { ConnectorError } from "../errors";
import type { AccountRef, NormalizedPost, NormalizedPostMetrics, PlatformConnector } from "../types";
import { accountMetricsAt, mockAccount, postMetricsAt, postsAt, type MockAccount, type MockPost } from "./model";

export function mockPostUrl(a: MockAccount, p: MockPost) {
  if (a.platform === "YOUTUBE") return `https://www.youtube.com/shorts/${p.id}`;
  if (a.platform === "INSTAGRAM") return `https://www.instagram.com/reel/${p.id}/`;
  return `https://www.tiktok.com/@${a.handle}/video/${p.id}`;
}

export function mockNormalizedPost(a: MockAccount, p: MockPost, t: number): NormalizedPost {
  const m = postMetricsAt(p, t)!;
  return {
    platformPostId: p.id,
    url: mockPostUrl(a, p),
    thumbnailUrl: `mock:thumb:${p.thumbSeed}`,
    caption: p.caption,
    publishedAt: new Date(p.publishedAt),
    durationSec: p.durationSec,
    views: m.views,
    likes: m.likes,
    comments: m.comments,
    shares: a.platform === "YOUTUBE" ? null : m.shares,
  };
}

export class MockConnector implements PlatformConnector {
  readonly id = "mock";
  readonly label = "Demo data (mock)";
  readonly capabilities = { postViews: true, shares: true, profileViews: false };
  constructor(readonly platform: PlatformKey) {}

  isConfigured() {
    return true;
  }

  private acct(ref: AccountRef) {
    if (ref.username.startsWith("notfound")) {
      throw new ConnectorError("NOT_FOUND", this.platform, "mock: handle starts with notfound");
    }
    if (ref.username.startsWith("private")) throw new ConnectorError("PRIVATE", this.platform, "mock: private");
    return mockAccount(this.platform, ref.username);
  }

  async getProfile(ref: AccountRef) {
    const a = this.acct(ref);
    await new Promise((r) => setTimeout(r, 500));
    return {
      platform: this.platform,
      platformAccountId: `mock-${a.handle}`,
      username: ref.username,
      displayName: a.displayName,
      profileUrl: ref.canonicalUrl,
      avatarUrl: `mock:avatar:${a.posts[0]?.thumbSeed ?? 1}:${a.displayName}`,
      bio: a.bio,
      isVerified: a.verified,
      ref,
    };
  }

  async getProfileMetrics(ref: AccountRef) {
    return accountMetricsAt(this.acct(ref), Date.now());
  }

  async getPosts(ref: AccountRef, { limit }: { limit: number }) {
    const a = this.acct(ref);
    const now = Date.now();
    await new Promise((r) => setTimeout(r, 700));
    return postsAt(a, now)
      .slice(-limit)
      .reverse()
      .map((p) => mockNormalizedPost(a, p, now));
  }

  async getPostMetrics(ref: AccountRef, ids: string[]): Promise<NormalizedPostMetrics[]> {
    const a = this.acct(ref);
    const now = Date.now();
    const wanted = new Set(ids);
    return a.posts
      .filter((p) => wanted.has(p.id))
      .map((p) => {
        const n = mockNormalizedPost(a, p, now);
        return { platformPostId: p.id, views: n.views, likes: n.likes, comments: n.comments, shares: n.shares };
      });
  }
}

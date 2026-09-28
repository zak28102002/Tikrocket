import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import tUser from "./fixtures/ensembledata/tt-user-info.json";
import tUserWeb from "./fixtures/ensembledata/tt-user-info-web.json";
import tPosts from "./fixtures/ensembledata/tt-user-posts.json";
import igUser from "./fixtures/ensembledata/ig-user-info.json";
import igReels from "./fixtures/ensembledata/ig-user-reels.json";

beforeAll(() => {
  process.env.ENSEMBLEDATA_TOKEN = "secret-token";
  process.env.TIKTOK_PROVIDER = "ensembledata";
  process.env.INSTAGRAM_PROVIDER = "ensembledata";
});

const fetchMock = vi.fn();
beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});
const respond = (status: number, body: unknown) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
const calledUrl = (i = 0) => new URL(fetchMock.mock.calls[i][0] as string);

describe("EnsembleData TikTok", async () => {
  const { normalizeTikTokUser, normalizeTikTokPosts, depthFor, EnsembleDataTikTokProvider } = await import("@/server/connectors/tiktok/providers/ensembledata");

  it("normalizes the mobile (snake_case) user shape", () => {
    const n = normalizeTikTokUser(tUser.data);
    expect(n.profile).toMatchObject({ username: "catrotapp", displayName: "Catrot", isVerified: false, avatarUrl: "https://p16.tiktokcdn.com/avatar-large.jpeg", platformAccountId: "6812345678901234567" });
    expect(n.metrics).toEqual({ followers: 21400, following: 12, totalLikes: 142000, totalViews: null, postCount: 48 });
    expect(n.privateAccount).toBe(false);
  });

  it("normalizes the web (camelCase) user shape", () => {
    const n = normalizeTikTokUser(tUserWeb.data);
    expect(n.profile).toMatchObject({ username: "mealzyapp", isVerified: true, avatarUrl: "https://p16/web.jpeg" });
    expect(n.metrics).toMatchObject({ followers: 9400, totalLikes: 88000, postCount: 31 });
  });

  it("normalizes posts, de-duplicates pinned posts, keeps missing stats null", () => {
    const posts = normalizeTikTokPosts(tPosts.data, "catrotapp");
    expect(posts).toHaveLength(2);
    expect(posts[0]).toMatchObject({ platformPostId: "7412000000000000001", views: 2410000, likes: 182000, comments: 1200, shares: 7800, durationSec: 23, thumbnailUrl: "https://p16/cover1.jpeg" });
    expect(posts[0].url).toBe("https://www.tiktok.com/@catrotapp/video/7412000000000000001");
    expect(posts[1]).toMatchObject({ comments: null, shares: null, durationSec: 15, thumbnailUrl: "https://p16/cover2.jpeg" });
  });

  it("computes depth in 10-post units, capped", () => {
    expect(depthFor(1)).toBe(1);
    expect(depthFor(50)).toBe(5);
    expect(depthFor(1000)).toBe(10);
  });

  it("calls the documented endpoints with the token, and redacts it from errors", async () => {
    const p = new EnsembleDataTikTokProvider();
    respond(200, tUser);
    await p.fetchProfile("catrotapp");
    expect(calledUrl().pathname).toBe("/apis/tt/user/info");
    expect(calledUrl().searchParams.get("token")).toBe("secret-token");

    respond(200, tPosts);
    await p.fetchVideos("catrotapp", 50);
    expect(calledUrl(1).pathname).toBe("/apis/tt/user/posts");
    expect(calledUrl(1).searchParams.get("depth")).toBe("5");

    respond(500, { detail: "Internal" });
    const err = await p.fetchProfile("x").catch((e) => e);
    expect(err.code).toBe("UPSTREAM");
    expect(err.detail).not.toContain("secret-token");
  });

  it("maps vendor errors to calm connector errors", async () => {
    const p = new EnsembleDataTikTokProvider();
    respond(404, { detail: "User not found" });
    await expect(p.fetchProfile("nobody")).rejects.toMatchObject({ code: "NOT_FOUND" });
    respond(495, { detail: "You have reached your daily units limit" });
    await expect(p.fetchProfile("x")).rejects.toMatchObject({ code: "RATE_LIMITED" });
    respond(401, { detail: "Invalid token" });
    await expect(p.fetchProfile("x")).rejects.toMatchObject({ code: "AUTH" });
    respond(200, { data: { user: { ...tUser.data.user, secret: 1 } } });
    await expect(p.fetchProfile("x")).rejects.toMatchObject({ code: "PRIVATE" });
  });

  it("registers as the TikTok connector when configured", async () => {
    const { connectorFor } = await import("@/server/connectors/registry");
    const c = connectorFor("TIKTOK", { isDemo: false });
    expect(c.id).toBe("tiktok-ensembledata");
    expect(c.isConfigured()).toBe(true);
    expect(connectorFor("INSTAGRAM", { isDemo: false }).id).toBe("instagram-ensembledata");
  });
});

describe("EnsembleData Instagram", async () => {
  const { normalizeIgUser, normalizeIgMedia, InstagramEnsembleConnector } = await import("@/server/connectors/instagram/ensembledata");

  it("normalizes the user", () => {
    const n = normalizeIgUser(igUser.data);
    expect(n.profile).toMatchObject({ username: "mealzyapp", platformAccountId: "5566778899", avatarUrl: "https://scontent.cdninstagram.com/pic.jpg" });
    expect(n.metrics).toEqual({ followers: 9400, following: 150, totalLikes: null, totalViews: null, postCount: 206 });
  });

  it("normalizes reels with view counts; missing values stay null", () => {
    const [a, b] = normalizeIgMedia(igReels.data);
    expect(a).toMatchObject({ platformPostId: "3400000000000000001", views: 812000, likes: 41000, comments: 380, durationSec: 18, url: "https://www.instagram.com/reel/DAbC123/", caption: "3 dinners under $5" });
    expect(b).toMatchObject({ views: null, likes: null, comments: 12, thumbnailUrl: null });
  });

  it("fetches reels by the stored user id", async () => {
    const c = new InstagramEnsembleConnector();
    respond(200, igReels);
    const posts = await c.getPosts({ platform: "INSTAGRAM", username: "mealzyapp", lookup: "handle", canonicalUrl: "", platformAccountId: "5566778899" }, { limit: 30 });
    expect(posts).toHaveLength(2);
    expect(calledUrl().pathname).toBe("/apis/instagram/user/reels");
    expect(calledUrl().searchParams.get("user_id")).toBe("5566778899");
    expect(calledUrl().searchParams.get("depth")).toBe("3");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeChannelMetrics, normalizeVideo, parseIsoDuration } from "@/server/connectors/youtube";
import { normalizeMedia } from "@/server/connectors/instagram";
import { HttpTikTokProvider } from "@/server/connectors/tiktok/providers/http";
import { ConnectorError } from "@/server/connectors/errors";
import { csvCell } from "@/server/services/export";

describe("YouTube normalization", () => {
  it("maps statistics and keeps missing values as null", () => {
    const v = normalizeVideo({
      id: "abc",
      snippet: { title: "Hello", publishedAt: "2026-09-01T10:00:00Z", thumbnails: { high: { url: "https://i.ytimg.com/h.jpg" } } },
      statistics: { viewCount: "1200", commentCount: "4" }, // likes hidden
      contentDetails: { duration: "PT1M3S" },
    });
    expect(v).toMatchObject({ views: 1200, likes: null, comments: 4, shares: null, durationSec: 63, thumbnailUrl: "https://i.ytimg.com/h.jpg" });
  });
  it("hidden subscriber counts are N/A, not 0", () => {
    const m = normalizeChannelMetrics({ id: "UC1", statistics: { hiddenSubscriberCount: true, subscriberCount: "0", viewCount: "10", videoCount: "2" } });
    expect(m).toEqual({ followers: null, following: null, totalLikes: null, totalViews: 10, postCount: 2 });
  });
  it("parses durations", () => {
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("PT1H2M")).toBe(3720);
    expect(parseIsoDuration(undefined)).toBeNull();
  });
});

describe("Instagram normalization", () => {
  it("never reports views/shares for business discovery", () => {
    const p = normalizeMedia({ id: "1", permalink: "https://instagram.com/p/x", media_type: "VIDEO", thumbnail_url: "https://cdn/t.jpg", like_count: 50, comments_count: 3, timestamp: "2026-09-01T00:00:00+0000" });
    expect(p).toMatchObject({ views: null, shares: null, likes: 50, comments: 3, thumbnailUrl: "https://cdn/t.jpg" });
  });
  it("hidden like counts stay null", () => {
    expect(normalizeMedia({ id: "2", media_type: "IMAGE", media_url: "https://cdn/i.jpg" }).likes).toBeNull();
  });
});

describe("TikTok HTTP provider", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });
  const respond = (status: number, body: unknown) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));

  it("normalizes profile + videos", async () => {
    const p = new HttpTikTokProvider("https://provider.test", "key");
    respond(200, { user: { id: 7, uniqueId: "CatrotApp", nickname: "Catrot", verified: false }, stats: { followerCount: 21400, heartCount: "142000", videoCount: 48 } });
    const prof = await p.fetchProfile("catrotapp");
    expect(prof.metrics).toEqual({ followers: 21400, following: null, totalLikes: 142000, totalViews: null, postCount: 48 });
    expect(prof.profile.username).toBe("catrotapp");
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer key");

    respond(200, { videos: [{ id: "99", desc: "hi", createTime: 1790000000, cover: "https://c/x.jpg", stats: { playCount: 1000, diggCount: 80 } }] });
    const [v] = await p.fetchVideos("catrotapp", 10);
    expect(v).toMatchObject({ platformPostId: "99", views: 1000, likes: 80, comments: null, shares: null, url: "https://www.tiktok.com/@catrotapp/video/99" });
  });

  it("maps errors to calm connector errors", async () => {
    const p = new HttpTikTokProvider("https://provider.test", "key");
    respond(404, { error: "not_found" });
    await expect(p.fetchProfile("nobody")).rejects.toMatchObject({ code: "NOT_FOUND" });
    respond(403, { error: "private" });
    await expect(p.fetchProfile("secret")).rejects.toMatchObject({ code: "PRIVATE" });
    respond(429, {});
    const err = await p.fetchProfile("x").catch((e) => e);
    expect(err).toBeInstanceOf(ConnectorError);
    expect(err.retryable).toBe(true);
    expect(err.userMessage).toContain("slow down");
    respond(200, { user: { uniqueId: 3 } });
    await expect(p.fetchProfile("weird")).rejects.toMatchObject({ code: "UPSTREAM" });
  });
});

describe("CSV", () => {
  it("escapes and guards against formula injection", () => {
    expect(csvCell(null)).toBe("N/A");
    expect(csvCell(12)).toBe("12");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK()")).toBe("'=HYPERLINK()");
  });
});

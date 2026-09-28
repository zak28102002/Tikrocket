import { describe, expect, it } from "vitest";
import { parseProfileUrl } from "@/lib/profile-url";

const ok = (url: string) => {
  const r = parseProfileUrl(url);
  if (!r.ok) throw new Error(`expected ok for ${url}: ${r.reason}`);
  return r.profile;
};

describe("parseProfileUrl", () => {
  it.each([
    ["https://www.tiktok.com/@catrotapp", "TIKTOK", "catrotapp"],
    ["tiktok.com/@CatrotApp?lang=en", "TIKTOK", "catrotapp"],
    ["https://m.tiktok.com/@catrot.app/", "TIKTOK", "catrot.app"],
    ["https://www.instagram.com/mealzyapp/", "INSTAGRAM", "mealzyapp"],
    ["instagram.com/Picksy.App", "INSTAGRAM", "picksy.app"],
    ["https://www.youtube.com/@Catrot", "YOUTUBE", "catrot"],
    ["https://youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw", "YOUTUBE", "UC_x5XG1OV2P6uZZ5FSM9Ttw"],
    ["https://www.youtube.com/user/GoogleDevelopers", "YOUTUBE", "googledevelopers"],
  ])("%s → %s @%s", (url, platform, username) => {
    const p = ok(url);
    expect(p.platform).toBe(platform);
    expect(p.username).toBe(username);
  });

  it("keeps channel-id case and marks lookup type", () => {
    expect(ok("youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw").lookup).toBe("channelId");
    expect(ok("youtube.com/@x_y").lookup).toBe("handle");
  });

  it.each([
    ["", "Paste"],
    ["https://vm.tiktok.com/ZMabc/", "Short links"],
    ["https://www.tiktok.com/explore", "profile URL"],
    ["https://www.instagram.com/p/Cabc123/", "profile URL"],
    ["https://www.youtube.com/watch?v=abc", "video link"],
    ["https://youtu.be/abc", "video link"],
    ["https://twitter.com/someone", "supports TikTok"],
    ["not a url at all", "URL"],
  ])("rejects %s", (url, reason) => {
    const r = parseProfileUrl(url);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain(reason);
  });
});

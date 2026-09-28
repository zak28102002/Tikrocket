/**
 * DEMO DATA MODEL — used only by the mock connector and the demo seed.
 * Never registered for production workspaces.
 *
 * Deterministic: every value is a pure function of (platform, handle, time), so
 * repeated refreshes show believable growth and the seed can backfill history
 * that lines up exactly with what later refreshes report.
 */
import type { PlatformKey } from "@/lib/profile-url";

const DAY = 86_400_000;
const ANCHOR = Date.UTC(2025, 0, 1);
const WINDOW_DAYS = 240;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (r: () => number) => {
  const u = Math.max(r(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
};

/** Presets so the demo portfolio has a believable shape. Unknown handles get hashed params. */
const PRESETS: Record<string, { scale: number; cadence: number; followers: number; name?: string }> = {
  "TIKTOK:catrotviral": { scale: 21000, cadence: 1.15, followers: 38000, name: "Catrot Viral" },
  "TIKTOK:catrotapp": { scale: 17000, cadence: 1.35, followers: 21400, name: "Catrot" },
  "INSTAGRAM:catrotapp": { scale: 7200, cadence: 1.8, followers: 12800, name: "Catrot" },
  "YOUTUBE:catrot": { scale: 5200, cadence: 2.6, followers: 6400, name: "Catrot" },
  "TIKTOK:mealzyapp": { scale: 9800, cadence: 1.4, followers: 16200, name: "Mealzy" },
  "INSTAGRAM:mealzyapp": { scale: 5600, cadence: 1.9, followers: 9400, name: "Mealzy · Recipes" },
  "TIKTOK:mealzyrecipes": { scale: 5200, cadence: 2.2, followers: 7300, name: "Mealzy Recipes" },
  "YOUTUBE:mealzy": { scale: 2600, cadence: 3.4, followers: 2100, name: "Mealzy" },
  "TIKTOK:picksyapp": { scale: 5400, cadence: 1.7, followers: 8800, name: "Picksy" },
  "INSTAGRAM:picksy.app": { scale: 2900, cadence: 2.4, followers: 4100, name: "Picksy" },
  "YOUTUBE:picksy": { scale: 1500, cadence: 4.1, followers: 900, name: "Picksy" },
  "TIKTOK:focusfoxapp": { scale: 3900, cadence: 2.0, followers: 5200, name: "Focus Fox" },
};

const CAPTIONS: Record<string, string[]> = {
  catrot: [
    "POV: your cat locks your phone at 11pm",
    "I let a cat control my screen time for 7 days",
    "Day 14 of Catrot vs. my doomscrolling",
    "When the cat says no more TikTok 😾",
    "Screen time went from 9h → 2h. Here's how",
    "Rating my friends' screen time (brutal)",
    "The app that guilt-trips you with a sad cat",
    "My cat is disappointed in my screen time again",
  ],
  mealzy: [
    "3 dinners under $5 you can make tonight",
    "Meal prep Sunday in 60 seconds",
    "What I eat in a week (planned by an app)",
    "Turning fridge leftovers into a real meal",
    "High-protein lunch, zero effort",
    "The grocery list that saved me $80",
  ],
  picksy: [
    "Can't decide where to eat? Let Picksy pick",
    "Date night decided in 3 seconds",
    "We let an app choose our weekend",
    "Friend group can't agree? Try this",
  ],
  generic: [
    "This changed my routine completely",
    "Nobody talks about this feature",
    "Day 1 of trying this app",
    "Honest review after 30 days",
  ],
};

export type MockPost = {
  id: string;
  index: number;
  publishedAt: number;
  finalViews: number;
  tauDays: number;
  viral: boolean;
  likeRate: number;
  commentRate: number;
  shareRate: number;
  caption: string;
  durationSec: number;
  thumbSeed: number;
};

export type MockAccount = {
  platform: PlatformKey;
  handle: string;
  displayName: string;
  bio: string;
  verified: boolean;
  followersBase: number;
  followRate: number;
  likesBase: number;
  viewsBase: number;
  postsBase: number;
  following: number;
  posts: MockPost[]; // every post from ANCHOR onwards (filtered by time at query)
};

const cache = new Map<string, MockAccount>();

export function mockAccount(platform: PlatformKey, handle: string): MockAccount {
  const key = `${platform}:${handle}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const r = rng(hash(key));
  const preset = PRESETS[key];
  const scale = preset?.scale ?? Math.round(800 + r() * 6000);
  const cadence = preset?.cadence ?? 1.5 + r() * 2.5;
  const brand = Object.keys(CAPTIONS).find((b) => handle.includes(b)) ?? "generic";
  const captions = CAPTIONS[brand];
  const pf = platform === "YOUTUBE" ? 0.6 : platform === "INSTAGRAM" ? 0.8 : 1;

  const posts: MockPost[] = [];
  let t = ANCHOR + r() * DAY * 2;
  let i = 0;
  const horizon = Date.UTC(2032, 0, 1);
  while (t < horizon) {
    const pr = rng(hash(`${key}#${i}`));
    const viral = pr() < 0.055;
    const base = scale * pf * Math.exp(gauss(pr) * 0.85);
    posts.push({
      id: `${platform === "YOUTUBE" ? "yt" : platform === "INSTAGRAM" ? "ig" : "tt"}${(hash(`${key}/${i}`) % 9e9).toString(36)}${i}`,
      index: i,
      publishedAt: t,
      finalViews: Math.round(viral ? base * (7 + pr() * 22) : base),
      tauDays: viral ? 2.2 + pr() * 2.5 : 0.9 + pr() * 1.8,
      viral,
      likeRate: (platform === "YOUTUBE" ? 0.032 : platform === "INSTAGRAM" ? 0.06 : 0.085) * (0.7 + pr() * 0.6),
      commentRate: 0.0045 * (0.5 + pr()),
      shareRate: (viral ? 0.011 : 0.0055) * (0.6 + pr() * 0.8),
      caption: captions[Math.floor(pr() * captions.length)],
      durationSec: Math.round(9 + pr() * 48),
      thumbSeed: hash(`${key}~${i}`),
    });
    t += cadence * DAY * (0.45 + pr() * 1.1);
    i++;
  }

  const acct: MockAccount = {
    platform,
    handle,
    displayName: preset?.name ?? handle.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    bio:
      brand === "catrot"
        ? "The cat that guards your screen time 🐈‍⬛ Download free ↓"
        : brand === "mealzy"
          ? "Plan a week of meals in 30 seconds. New recipes daily."
          : brand === "picksy"
            ? "Stop arguing about where to eat."
            : "Building apps people love.",
    verified: (preset?.followers ?? 0) > 20000,
    followersBase: preset?.followers ?? Math.round(500 + r() * 9000),
    followRate: 0.0028 + r() * 0.0025,
    likesBase: Math.round((preset?.followers ?? 3000) * 9),
    viewsBase: Math.round((preset?.followers ?? 3000) * 60),
    postsBase: Math.round(8 + r() * 20),
    following: Math.round(12 + r() * 180),
    posts,
  };
  cache.set(key, acct);
  return acct;
}

/** Posts that exist at time t and fall inside the tracked window. */
export function postsAt(a: MockAccount, t: number) {
  const from = t - WINDOW_DAYS * DAY;
  return a.posts.filter((p) => p.publishedAt <= t && p.publishedAt >= from);
}

export function postMetricsAt(p: MockPost, t: number) {
  const age = (t - p.publishedAt) / DAY;
  if (age < 0) return null;
  const x = age / p.tauDays;
  // Viral posts ignite after a short delay; normal posts saturate quickly.
  const g = p.viral ? 1 / (1 + Math.exp(-(x - 1.4) * 2.2)) - 1 / (1 + Math.exp(1.4 * 2.2)) : 1 - Math.exp(-x);
  const longTail = 1 + Math.min(age, 120) * 0.0012;
  const views = Math.max(0, Math.round(p.finalViews * Math.max(g, 0) * longTail));
  return {
    views,
    likes: Math.round(views * p.likeRate),
    comments: Math.round(views * p.commentRate),
    shares: Math.round(views * p.shareRate),
  };
}

export function accountMetricsAt(a: MockAccount, t: number) {
  let views = 0;
  let likes = 0;
  let count = 0;
  for (const p of a.posts) {
    if (p.publishedAt > t) break;
    const m = postMetricsAt(p, t)!;
    views += m.views;
    likes += m.likes;
    count++;
  }
  return {
    followers: Math.round(a.followersBase + views * a.followRate),
    following: a.following,
    totalLikes: a.platform === "YOUTUBE" ? null : a.likesBase + likes,
    totalViews: a.platform === "YOUTUBE" ? a.viewsBase + views : null,
    postCount: a.postsBase + count,
  };
}

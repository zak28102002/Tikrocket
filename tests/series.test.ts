import { describe, expect, it } from "vitest";
import {
  byAccount,
  chartSeries,
  cumulative,
  engagementRate,
  growthPct,
  periodSummary,
  scopeSeries,
  type DailyRow,
} from "@/server/analytics/series";
import { resolveRange } from "@/lib/range";

const row = (accountId: string, date: string, views: number | null, followers: number | null = null): DailyRow => ({
  accountId,
  date,
  views,
  followers,
  likes: null,
  posts: null,
  comments: null,
  shares: null,
});

describe("cumulative", () => {
  it("forward-fills and keeps null before first data", () => {
    const rows = [row("a", "2026-09-02", 100), row("a", "2026-09-04", 160)];
    expect(cumulative(rows, ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"], "views")).toEqual([
      null, 100, 100, 160,
    ]);
  });
  it("skips null metric values instead of treating them as zero", () => {
    const rows = [row("a", "2026-09-01", 100), row("a", "2026-09-02", null)];
    expect(cumulative(rows, ["2026-09-01", "2026-09-02"], "views")).toEqual([100, 100]);
  });
});

describe("scopeSeries", () => {
  it("does not create a spike when an account starts tracking mid-range", () => {
    const acc = byAccount([
      row("a", "2026-09-01", 1000),
      row("a", "2026-09-02", 1100),
      row("a", "2026-09-03", 1300),
      row("b", "2026-09-03", 5_000_000), // new account with big lifetime views
    ]);
    const s = scopeSeries(acc, "2026-09-02", "2026-09-03", "views");
    expect(s.gains).toEqual([100, 200]);
    expect(s.level).toEqual([1100, 5_001_300]);
  });
  it("returns null gains when nothing is known", () => {
    const s = scopeSeries(new Map(), "2026-09-01", "2026-09-02", "views");
    expect(s.gains).toEqual([null, null]);
  });
});

describe("growthPct", () => {
  it("computes percentage change", () => expect(growthPct(125, 100)).toBe(25));
  it("withholds when previous is zero or unknown", () => {
    expect(growthPct(10, 0)).toBeNull();
    expect(growthPct(10, null)).toBeNull();
    expect(growthPct(null, 10)).toBeNull();
  });
});

describe("periodSummary", () => {
  const today = "2026-09-28";
  const mk = (startViews: number, perDay: number, days: number, id = "a") =>
    Array.from({ length: days }, (_, i) => {
      const d = new Date(Date.UTC(2026, 8, 28 - (days - 1) + i)).toISOString().slice(0, 10);
      return row(id, d, startViews + perDay * i, 1000 + i);
    });

  it("flow metric: gains within period vs previous period", () => {
    // 20 days of history, +10/day for the first 13 days then +20/day.
    const rows = mk(0, 10, 20).map((r, i) => ({ ...r, views: i < 13 ? i * 10 : 120 + (i - 12) * 20 }));
    const range = resolveRange({ range: "7d" }, today, null);
    const s = periodSummary(byAccount(rows), range, "views");
    expect(s.value).toBe(140);
    expect(s.previous).toBe(70);
    expect(s.changePct).toBe(100);
    expect(s.lifetime).toBe(rows[rows.length - 1].views);
    expect(s.today).toBe(20);
  });

  it("withholds comparison when history does not cover the previous period", () => {
    const rows = mk(0, 10, 9);
    const s = periodSummary(byAccount(rows), resolveRange({ range: "7d" }, today, null), "views");
    expect(s.comparable).toBe(false);
    expect(s.changePct).toBeNull();
    expect(s.value).toBe(70);
  });

  it("flags partial periods", () => {
    const rows = mk(0, 10, 3);
    const s = periodSummary(byAccount(rows), resolveRange({ range: "7d" }, today, null), "views");
    expect(s.partialSince).toBe("2026-09-26");
    expect(s.value).toBe(20);
  });

  it("stock metric: level and net change", () => {
    const rows = mk(0, 10, 20);
    const s = periodSummary(byAccount(rows), resolveRange({ range: "7d" }, today, null), "followers");
    expect(s.value).toBe(1019);
    expect(s.change).toBe(7);
    expect(s.previous).toBe(1012);
    expect(s.changePct).toBeCloseTo((7 / 1012) * 100);
  });

  it("unavailable metric stays null, not zero", () => {
    const rows = mk(0, 10, 20).map((r) => ({ ...r, views: null }));
    const s = periodSummary(byAccount(rows), resolveRange({ range: "7d" }, today, null), "views");
    expect(s.value).toBeNull();
    expect(s.lifetime).toBeNull();
  });
});

describe("chartSeries", () => {
  it("reports day-over-day change for flows", () => {
    const rows = [row("a", "2026-09-26", 0), row("a", "2026-09-27", 100), row("a", "2026-09-28", 250)];
    const pts = chartSeries(byAccount(rows), resolveRange({ range: "custom", from: "2026-09-27", to: "2026-09-28" }, "2026-09-28", null), "views");
    expect(pts).toEqual([
      { date: "2026-09-27", value: 100, change: null },
      { date: "2026-09-28", value: 150, change: 50 },
    ]);
  });
});

describe("engagementRate", () => {
  it("needs views, likes and comments", () => {
    expect(engagementRate({ views: 1000, likes: 80, comments: 10, shares: 10 })).toBe(10);
    expect(engagementRate({ views: 1000, likes: 80, comments: 10, shares: null })).toBe(9);
    expect(engagementRate({ views: 1000, likes: null, comments: 10, shares: 1 })).toBeNull();
    expect(engagementRate({ views: 0, likes: 1, comments: 1, shares: 1 })).toBeNull();
  });
});

/**
 * Pure analytics math over daily cumulative rows. No I/O — fully unit-tested.
 *
 * Rules
 * - Rows hold cumulative (lifetime) values as of the end of a day.
 * - Missing days are forward-filled from the last known value.
 * - Before an account's first data point the value is null (never 0).
 * - Gains are computed per account and then summed, so an account that starts
 *   being tracked mid-range never shows up as a giant fake spike.
 */
import { addDays, eachDay, type DayKey } from "@/lib/dates";
import type { ResolvedRange } from "@/lib/range";

export const METRICS = ["views", "likes", "followers", "posts", "comments", "shares"] as const;
export type Metric = (typeof METRICS)[number];

/** Flow metrics are counted within a period; stock metrics are a level at a point in time. */
export const METRIC_KIND: Record<Metric, "flow" | "stock"> = {
  views: "flow",
  likes: "flow",
  posts: "flow",
  comments: "flow",
  shares: "flow",
  followers: "stock",
};

export type DailyRow = { accountId: string; date: DayKey } & Record<Metric, number | null>;

/** Group rows by account, sorted ascending by date. */
export function byAccount(rows: DailyRow[]): Map<string, DailyRow[]> {
  const m = new Map<string, DailyRow[]>();
  for (const r of rows) {
    const list = m.get(r.accountId);
    if (list) list.push(r);
    else m.set(r.accountId, [r]);
  }
  for (const list of m.values()) list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return m;
}

/** Forward-filled cumulative values for one account over `days`. */
export function cumulative(rows: DailyRow[], days: DayKey[], metric: Metric): (number | null)[] {
  const out: (number | null)[] = new Array(days.length).fill(null);
  let j = 0;
  let last: number | null = null;
  for (let i = 0; i < days.length; i++) {
    while (j < rows.length && rows[j].date <= days[i]) {
      const v = rows[j][metric];
      if (v !== null && v !== undefined) last = v;
      j++;
    }
    out[i] = last;
  }
  return out;
}

/** Day-over-day gains; null when either side is unknown. `cum` includes one leading day. */
export function gainsFrom(cum: (number | null)[]): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 1; i < cum.length; i++) {
    const a = cum[i - 1];
    const b = cum[i];
    out.push(a === null || b === null ? null : b - a);
  }
  return out;
}

const sumNullable = (vals: (number | null)[]) => {
  let s = 0;
  let any = false;
  for (const v of vals) {
    if (v !== null) {
      s += v;
      any = true;
    }
  }
  return any ? s : null;
};

export type ScopeSeries = {
  days: DayKey[];
  /** Summed forward-filled cumulative values (lifetime level) per day. */
  level: (number | null)[];
  /** Summed per-account daily gains. */
  gains: (number | null)[];
};

/** Aggregate a set of accounts over [from, to] for one metric. */
export function scopeSeries(accounts: Map<string, DailyRow[]>, from: DayKey, to: DayKey, metric: Metric): ScopeSeries {
  const days = eachDay(from, to);
  const withLead = [addDays(from, -1), ...days];
  const levels: (number | null)[][] = [];
  const gains: (number | null)[][] = [];
  for (const rows of accounts.values()) {
    const cum = cumulative(rows, withLead, metric);
    levels.push(cum.slice(1));
    gains.push(gainsFrom(cum));
  }
  return {
    days,
    level: days.map((_, i) => sumNullable(levels.map((l) => l[i]))),
    gains: days.map((_, i) => sumNullable(gains.map((g) => g[i]))),
  };
}

export function growthPct(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export type PeriodSummary = {
  metric: Metric;
  kind: "flow" | "stock";
  /** Flow: gained within the period. Stock: level at period end. */
  value: number | null;
  /** Same measure for the previous period (flow) or level at period start (stock). */
  previous: number | null;
  /** Flow: value − previous. Stock: net change within the period. */
  change: number | null;
  changePct: number | null;
  /** Lifetime level at period end. */
  lifetime: number | null;
  /** Most recent day's gain. */
  today: number | null;
  /** First tracked day when tracking began after the period started. */
  partialSince: DayKey | null;
  /** Whether the previous period is fully covered by history (else % is withheld). */
  comparable: boolean;
};

export function firstDataDay(accounts: Map<string, DailyRow[]>, metric: Metric): DayKey | null {
  let first: DayKey | null = null;
  for (const rows of accounts.values()) {
    const r = rows.find((x) => x[metric] !== null);
    if (r && (first === null || r.date < first)) first = r.date;
  }
  return first;
}

export function periodSummary(accounts: Map<string, DailyRow[]>, range: ResolvedRange, metric: Metric): PeriodSummary {
  const kind = METRIC_KIND[metric];
  const cur = scopeSeries(accounts, range.from, range.to, metric);
  const first = firstDataDay(accounts, metric);
  const partialSince = first && first > range.from ? first : null;
  const lifetime = cur.level[cur.level.length - 1] ?? null;
  const today = cur.gains[cur.gains.length - 1] ?? null;
  const periodGain = sumNullable(cur.gains);

  // A comparison is only honest when history covers the whole previous period.
  const comparable = Boolean(range.prevFrom && first && first <= addDays(range.prevFrom, -1));

  if (kind === "stock") {
    const startLevel = scopeSeries(accounts, range.from, range.from, metric).level[0];
    const levelBefore = startLevel === null ? null : startLevel - (cur.gains[0] ?? 0);
    const covered = Boolean(first && first <= addDays(range.from, -1));
    return {
      metric,
      kind,
      value: lifetime,
      previous: covered ? levelBefore : null,
      change: periodGain,
      changePct: covered ? growthPct(lifetime, levelBefore) : null,
      lifetime,
      today,
      partialSince,
      comparable: covered,
    };
  }

  let previous: number | null = null;
  if (range.prevFrom && range.prevTo) {
    previous = sumNullable(scopeSeries(accounts, range.prevFrom, range.prevTo, metric).gains);
  }
  return {
    metric,
    kind,
    value: periodGain,
    previous: comparable ? previous : null,
    change: comparable && periodGain !== null && previous !== null ? periodGain - previous : null,
    changePct: comparable ? growthPct(periodGain, previous) : null,
    lifetime,
    today,
    partialSince,
    comparable,
  };
}

export type ChartPoint = { date: DayKey; value: number | null; change: number | null };

/** Chart-ready series: daily gains for flow metrics, level for stock metrics. */
export function chartSeries(accounts: Map<string, DailyRow[]>, range: ResolvedRange, metric: Metric): ChartPoint[] {
  const s = scopeSeries(accounts, range.from, range.to, metric);
  const values = METRIC_KIND[metric] === "stock" ? s.level : s.gains;
  return s.days.map((date, i) => {
    const v = values[i];
    const p = i > 0 ? values[i - 1] : null;
    return {
      date,
      value: v,
      change: METRIC_KIND[metric] === "stock" ? s.gains[i] : v !== null && p !== null ? v - p : null,
    };
  });
}

/** Down-sample long daily series into ≤ `max` buckets (sums for flows, last value for stocks). */
export function bucketize(points: ChartPoint[], max: number, kind: "flow" | "stock"): ChartPoint[] {
  if (points.length <= max) return points;
  const size = Math.ceil(points.length / max);
  const out: ChartPoint[] = [];
  for (let i = 0; i < points.length; i += size) {
    const chunk = points.slice(i, i + size);
    const vals = chunk.map((c) => c.value);
    const value = kind === "flow" ? sumNullable(vals) : ([...vals].reverse().find((v) => v !== null) ?? null);
    const prev = out[out.length - 1]?.value ?? null;
    out.push({
      date: chunk[chunk.length - 1].date,
      value,
      change: kind === "stock" ? sumNullable(chunk.map((c) => c.change)) : value !== null && prev !== null ? value - prev : null,
    });
  }
  return out;
}

/** (likes + comments [+ shares]) / views, only when the required inputs exist. */
export function engagementRate(m: { views: number | null; likes: number | null; comments: number | null; shares: number | null }) {
  if (!m.views || m.likes === null || m.comments === null) return null;
  return ((m.likes + m.comments + (m.shares ?? 0)) / m.views) * 100;
}

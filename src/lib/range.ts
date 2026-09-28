import { addDays, diffDays, isDayKey, type DayKey } from "./dates";

export type RangeKey = "7d" | "30d" | "90d" | "6m" | "1y" | "all" | "custom";

export const RANGE_PRESETS: { key: Exclude<RangeKey, "custom">; short: string; label: string; days: number | null }[] = [
  { key: "7d", short: "7D", label: "Last 7 days", days: 7 },
  { key: "30d", short: "30D", label: "Last 30 days", days: 30 },
  { key: "90d", short: "90D", label: "Last 90 days", days: 90 },
  { key: "6m", short: "6M", label: "Last 6 months", days: 182 },
  { key: "1y", short: "1Y", label: "Last 12 months", days: 365 },
  { key: "all", short: "All", label: "All time", days: null },
];

export const DEFAULT_RANGE: RangeKey = "30d";

export type RangeInput = { range: RangeKey; from?: string; to?: string };

export type ResolvedRange = {
  key: RangeKey;
  from: DayKey;
  to: DayKey;
  days: number;
  /** Previous period of equal length, or null (All time). */
  prevFrom: DayKey | null;
  prevTo: DayKey | null;
  label: string;
  compareLabel: string | null;
};

export function parseRangeInput(params: { range?: string | null; from?: string | null; to?: string | null }): RangeInput {
  const r = params.range ?? DEFAULT_RANGE;
  if (r === "custom" && params.from && params.to && isDayKey(params.from) && isDayKey(params.to)) {
    const [from, to] = params.from <= params.to ? [params.from, params.to] : [params.to, params.from];
    return { range: "custom", from, to };
  }
  if (RANGE_PRESETS.some((p) => p.key === r)) return { range: r as RangeKey };
  return { range: DEFAULT_RANGE };
}

/**
 * Resolve a range to concrete local days. `today` is the workspace's current
 * day; `earliest` is the first tracked day (used for All time).
 */
export function resolveRange(input: RangeInput, today: DayKey, earliest: DayKey | null): ResolvedRange {
  if (input.range === "custom" && input.from && input.to) {
    const to = input.to > today ? today : input.to;
    const from = input.from > to ? to : input.from;
    const days = diffDays(to, from) + 1;
    return {
      key: "custom",
      from,
      to,
      days,
      prevFrom: addDays(from, -days),
      prevTo: addDays(from, -1),
      label: `${fmtShort(from)} – ${fmtShort(to)}`,
      compareLabel: `vs previous ${days} days`,
    };
  }
  const preset = RANGE_PRESETS.find((p) => p.key === input.range) ?? RANGE_PRESETS[1];
  if (preset.days === null) {
    const from = earliest && earliest < today ? earliest : addDays(today, -29);
    return {
      key: "all",
      from,
      to: today,
      days: diffDays(today, from) + 1,
      prevFrom: null,
      prevTo: null,
      label: "All time",
      compareLabel: null,
    };
  }
  const from = addDays(today, -(preset.days - 1));
  return {
    key: preset.key,
    from,
    to: today,
    days: preset.days,
    prevFrom: addDays(from, -preset.days),
    prevTo: addDays(from, -1),
    label: preset.label,
    compareLabel: `vs previous ${preset.key === "6m" ? "6 months" : preset.key === "1y" ? "12 months" : `${preset.days} days`}`,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtShort(k: DayKey) {
  const [, m, d] = k.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

export function rangeToSearch(r: RangeInput): string {
  const p = new URLSearchParams({ range: r.range });
  if (r.range === "custom" && r.from && r.to) {
    p.set("from", r.from);
    p.set("to", r.to);
  }
  return p.toString();
}

/**
 * Calendar-day helpers. Days are represented as "YYYY-MM-DD" keys in the
 * workspace timezone; arithmetic happens in UTC so DST never skews a day.
 */
export type DayKey = string;

const fmtCache = new Map<string, Intl.DateTimeFormat>();

export function dayKey(date: Date, timeZone = "UTC"): DayKey {
  let f = fmtCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    fmtCache.set(timeZone, f);
  }
  return f.format(date);
}

export const keyToUtc = (k: DayKey) => new Date(`${k}T00:00:00.000Z`);
export const utcToKey = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(k: DayKey, n: number): DayKey {
  const d = keyToUtc(k);
  d.setUTCDate(d.getUTCDate() + n);
  return utcToKey(d);
}

export function diffDays(a: DayKey, b: DayKey) {
  return Math.round((keyToUtc(a).getTime() - keyToUtc(b).getTime()) / 86_400_000);
}

export function eachDay(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

export const isDayKey = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(keyToUtc(s).getTime());

function tzOffsetMs(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The UTC instant at which local day `k` starts in `timeZone`. */
export function startOfDayUtc(k: DayKey, timeZone = "UTC"): Date {
  const guess = keyToUtc(k).getTime();
  const first = guess - tzOffsetMs(new Date(guess), timeZone);
  return new Date(guess - tzOffsetMs(new Date(first), timeZone));
}

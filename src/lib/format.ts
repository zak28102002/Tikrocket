/** Number & date formatting. `null` always renders as N/A — never as 0. */
export const NA = "N/A";

const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumSignificantDigits: 3 });
const fullFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function compact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return NA;
  if (Math.abs(n) < 1000) return fullFmt.format(n);
  return compactFmt.format(n);
}

export function full(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return NA;
  return fullFmt.format(n);
}

const MINUS = "−";

export function signed(n: number | null | undefined, fmt: (x: number) => string = compact): string {
  if (n === null || n === undefined) return NA;
  if (n === 0) return "0";
  return `${n > 0 ? "+" : MINUS}${fmt(Math.abs(n))}`;
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return NA;
  const abs = Math.abs(n);
  const d = abs >= 100 ? 0 : digits;
  const s = abs.toFixed(d);
  if (Number(s) === 0) return "0%";
  return `${n > 0 ? "+" : MINUS}${s}%`;
}

export function rate(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return NA;
  return `${n.toFixed(digits)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-09-27" → "Sep 27" (optionally with year). */
export function dayLabel(key: string, opts: { long?: boolean; year?: boolean } = {}) {
  const [y, m, d] = key.split("-").map(Number);
  const month = (opts.long ? MONTHS_LONG : MONTHS)[m - 1];
  return opts.year ? `${month} ${d}, ${y}` : `${month} ${d}`;
}

export function dateLabel(iso: string | null | undefined, opts: { year?: boolean } = {}) {
  if (!iso) return NA;
  const dt = new Date(iso);
  const sameYear = dt.getFullYear() === new Date().getFullYear();
  return `${MONTHS[dt.getMonth()]} ${dt.getDate()}${opts.year || !sameYear ? `, ${dt.getFullYear()}` : ""}`;
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "Never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "Just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return dateLabel(iso);
}

export function duration(sec: number | null | undefined) {
  if (sec === null || sec === undefined) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function refreshLabel(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return "Workspace default";
  if (minutes === 0) return "Manual only";
  if (minutes < 60) return `Every ${minutes} min`;
  const h = minutes / 60;
  return h === 1 ? "Every hour" : `Every ${h} hours`;
}

/** Future relative time: "in 4h", "in 12m", "soon". */
export function timeUntil(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "not scheduled";
  const m = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (m <= 1) return "soon";
  if (m < 60) return `in ${m}m`;
  const h = Math.round(m / 60);
  return h < 48 ? `in ${h}h` : `in ${Math.round(h / 24)}d`;
}

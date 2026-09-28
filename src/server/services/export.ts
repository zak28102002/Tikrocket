import "server-only";
import { db } from "@/server/db";
import { PLATFORM_META } from "@/lib/platforms";
import type { RangeInput } from "@/lib/range";
import type { PlatformKey } from "@/lib/profile-url";
import type { Viewer } from "@/server/auth/session";
import { cumulative, type Metric } from "@/server/analytics/series";
import { eachDay } from "@/lib/dates";
import { loadScope } from "./shared";

const HEADER = ["Date", "App", "Platform", "Account", "Followers", "Posts", "Views", "Likes", "Comments", "Shares"];

/** RFC 4180 escaping plus formula-injection guard for spreadsheet apps. */
export function csvCell(v: string | number | null): string {
  if (v === null) return "N/A";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Daily, per-account rows with cumulative (lifetime) values as of each day.
 * Unknown values export as N/A. Streamed so large ranges never buffer in memory.
 */
export async function exportCsv(viewer: Viewer, input: RangeInput, filters: { appId?: string; platform?: PlatformKey }) {
  const { accounts, range, byAccount } = await loadScope(viewer, filters, input);
  const days = eachDay(range.from, range.to);
  const metrics: Metric[] = ["followers", "posts", "views", "likes", "comments", "shares"];
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("﻿" + HEADER.join(",") + "\n"));
      for (const a of accounts) {
        const rows = byAccount.get(a.id) ?? [];
        const series = metrics.map((m) => cumulative(rows, days, m));
        let chunk = "";
        days.forEach((day, i) => {
          if (series.every((s) => s[i] === null)) return; // not tracked yet
          chunk +=
            [day, a.app.name, PLATFORM_META[a.platform as PlatformKey].label, `@${a.username}`, ...series.map((s) => s[i])]
              .map(csvCell)
              .join(",") + "\n";
        });
        if (chunk) controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  const name = `pulse-${viewer.workspace.slug}-${range.from}-to-${range.to}.csv`;
  return { stream, filename: name };
}

"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { compact } from "@/lib/format";

/** Restrained horizontal bars for breakdowns (no pie charts). */
export function BarList({
  items,
  format = compact,
  suffix,
}: {
  items: { key: string; label: ReactNode; value: number | null; color?: string; meta?: ReactNode }[];
  format?: (n: number | null) => string;
  suffix?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value ?? 0));
  const total = items.reduce((s, i) => s + (i.value ?? 0), 0);
  return (
    <ul className="space-y-4">
      {items.map((it, idx) => {
        const share = it.value !== null && total > 0 ? (it.value / total) * 100 : null;
        return (
          <li key={it.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="flex min-w-0 items-center gap-2 text-fg">{it.label}</span>
              <span className="flex shrink-0 items-baseline gap-2 tnum">
                <span className="font-semibold text-fg">
                  {format(it.value)}
                  {suffix && it.value !== null ? <span className="ml-1 font-normal text-fg-3">{suffix}</span> : null}
                </span>
                {share !== null && <span className="w-10 text-right text-[12px] text-fg-3">{share.toFixed(0)}%</span>}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
              {it.value !== null && (
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: it.color ?? "var(--accent)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(1.5, ((it.value ?? 0) / max) * 100)}%` }}
                  transition={{ duration: 0.8, delay: 0.06 * idx, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </div>
            {it.meta && <div className="mt-1.5 text-[12px] text-fg-3">{it.meta}</div>}
          </li>
        );
      })}
    </ul>
  );
}

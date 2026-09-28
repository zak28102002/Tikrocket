"use client";

import { animate, useInView, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/**
 * A formatted number that counts up the first time it scrolls into view, then
 * glides between values when data changes (e.g. switching the date range).
 */
export function CountUp({ value, format, duration = 0.9 }: { value: number | null; format: (n: number | null) => string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(0);
  useMotionValueEvent(mv, "change", (v) => setDisplay(v));

  useEffect(() => {
    if (value === null || !inView) return;
    if (reduce) {
      mv.jump(value);
      return;
    }
    const c = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [value, inView, reduce, duration, mv]);

  if (value === null) return <span ref={ref}>{format(null)}</span>;
  const shown = Math.abs(display - value) < 0.5 ? value : Math.round(display);
  return <span ref={ref}>{format(shown)}</span>;
}

"use client";

import { curveMonotoneX, line as d3line, area as d3area } from "d3-shape";
import { useId, useMemo } from "react";

/** Compact trend line. Quiet by design; the number beside it carries the value. */
export function Sparkline({
  values,
  width = 88,
  height = 28,
  color = "var(--accent)",
  className,
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  const gid = `sg${useId().replace(/:/g, "")}`;
  const { line, fill, last } = useMemo(() => {
    const nums = values.filter((v): v is number => v !== null);
    if (nums.length < 2) return { line: null, fill: null, last: null };
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const pad = 3;
    const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = (v: number) => pad + (1 - (max === min ? 0.5 : (v - min) / (max - min))) * (height - pad * 2);
    const l = d3line<number | null>()
      .defined((v) => v !== null)
      .x((_, i) => x(i))
      .y((v) => y(v!))
      .curve(curveMonotoneX)(values);
    const a = d3area<number | null>()
      .defined((v) => v !== null)
      .x((_, i) => x(i))
      .y0(height)
      .y1((v) => y(v!))
      .curve(curveMonotoneX)(values);
    let li = values.length - 1;
    while (li >= 0 && values[li] === null) li--;
    return { line: l, fill: a, last: li >= 0 ? { x: x(li), y: y(values[li]!) } : null };
  }, [values, width, height]);

  if (!line) return <div style={{ width, height }} className={className} aria-hidden />;
  return (
    <svg width={width} height={height} className={className} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.14} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fill ?? ""} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {last && <circle cx={last.x} cy={last.y} r={2.25} fill={color} />}
    </svg>
  );
}

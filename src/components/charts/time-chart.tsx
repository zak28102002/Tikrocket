"use client";

import { area as d3area, curveMonotoneX, line as d3line } from "d3-shape";
import { scaleLinear } from "d3-scale";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { compact, dayLabel, full, signed } from "@/lib/format";

export type Series = {
  id: string;
  label: string;
  color: string;
  points: { date: string; value: number | null; change?: number | null }[];
};

type Props = {
  series: Series[];
  height?: number;
  /** Fill the area under a single series. */
  area?: boolean;
  valueLabel?: string;
  formatValue?: (n: number | null) => string;
  formatAxis?: (n: number) => string;
  /** Show the "Change" row in the tooltip (single series). */
  showChange?: boolean;
  className?: string;
  /** Changing this key re-runs the draw-in animation (e.g. range change). */
  animationKey?: string;
  emptyLabel?: string;
};

const M = { top: 12, right: 12, bottom: 28, left: 48 };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function TimeChart({
  series,
  height = 280,
  area = false,
  valueLabel = "Value",
  formatValue = full,
  formatAxis = compact,
  showChange = true,
  className,
  animationKey,
  emptyLabel = "No data for this period yet",
}: Props) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId().replace(/:/g, "");
  const n = series[0]?.points.length ?? 0;
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;

  const allValues = useMemo(() => series.flatMap((s) => s.points.map((p) => p.value)).filter((v): v is number => v !== null), [series]);
  const hasData = allValues.length > 0;

  const { x, y, ticks } = useMemo(() => {
    const min = hasData ? Math.min(0, ...allValues) : 0;
    const max = hasData ? Math.max(...allValues) : 1;
    const y = scaleLinear()
      .domain([min, max === min ? min + 1 : max])
      .nice(4)
      .range([innerH, 0]);
    const x = (i: number) => (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    return { x, y, ticks: y.ticks(4) };
  }, [allValues, hasData, innerH, innerW, n]);

  const paths = useMemo(
    () =>
      series.map((s) => {
        const line = d3line<{ value: number | null }>()
          .defined((p) => p.value !== null)
          .x((_, i) => x(i))
          .y((p) => y(p.value ?? 0))
          .curve(curveMonotoneX);
        const fill = d3area<{ value: number | null }>()
          .defined((p) => p.value !== null)
          .x((_, i) => x(i))
          .y0(y(Math.max(0, y.domain()[0])))
          .y1((p) => y(p.value ?? 0))
          .curve(curveMonotoneX);
        return { id: s.id, color: s.color, line: line(s.points) ?? "", fill: fill(s.points) ?? "" };
      }),
    [series, x, y],
  );

  // X-axis labels: ~6 evenly spaced, always including the ends.
  const xLabels = useMemo(() => {
    if (n === 0 || innerW <= 0) return [];
    const count = Math.max(2, Math.min(n, Math.floor(innerW / 110)));
    const idx = new Set<number>();
    for (let k = 0; k < count; k++) idx.add(Math.round((k / (count - 1)) * (n - 1)));
    return [...idx].map((i) => ({ i, label: dayLabel(series[0].points[i].date) }));
  }, [n, innerW, series]);

  const onMove = useCallback(
    (e: PointerEvent<SVGRectElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const i = n <= 1 ? 0 : Math.round((px / innerW) * (n - 1));
      setHover(Math.max(0, Math.min(n - 1, i)));
    },
    [innerW, n],
  );

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
    else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
    else if (e.key === "Escape") setHover(null);
    else return;
    e.preventDefault();
  };

  const tip = hover !== null && hasData ? series.map((s) => ({ s, p: s.points[hover] })) : null;
  const tipX = hover !== null ? M.left + x(hover) : 0;
  const tipLeft = tipX > width - 200;
  const drawKey = `${animationKey ?? ""}:${n}`;

  return (
    <div ref={wrapRef} className={cn("relative w-full select-none", className)} style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="block overflow-visible outline-none"
          role="img"
          aria-label={`${valueLabel} chart`}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        >
          <defs>
            {paths.map((p) => (
              <linearGradient key={p.id} id={`fill-${uid}-${p.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={p.color} stopOpacity={0.16} />
                <stop offset="100%" stopColor={p.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <g transform={`translate(${M.left},${M.top})`}>
            {/* Grid + y ticks */}
            {hasData && ticks.map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x1={0} x2={innerW} stroke="var(--chart-grid)" strokeWidth={1} />
                <text x={-12} dy="0.32em" textAnchor="end" className="fill-[var(--fg-3)] text-[11px] tnum">
                  {formatAxis(t)}
                </text>
              </g>
            ))}
            {/* X labels */}
            {xLabels.map(({ i, label }, k) => (
              <text
                key={i}
                x={x(i)}
                y={innerH + 20}
                textAnchor={k === 0 ? "start" : k === xLabels.length - 1 ? "end" : "middle"}
                className="fill-[var(--fg-3)] text-[11px] tnum"
              >
                {label}
              </text>
            ))}

            <clipPath id={`clip-${uid}`}>
              <motion.rect
                key={drawKey}
                x={-4}
                y={-8}
                height={innerH + 16}
                initial={{ width: 0 }}
                animate={{ width: innerW + 8 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            </clipPath>
            {hasData &&
              paths.map((p) => (
                <g key={p.id} clipPath={`url(#clip-${uid})`}>
                  {area && series.length === 1 && (
                    <motion.path
                      initial={{ d: p.fill }}
                      animate={{ d: p.fill }}
                      transition={{ d: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } }}
                      fill={`url(#fill-${uid}-${p.id})`}
                    />
                  )}
                  <motion.path
                    initial={{ d: p.line }}
                    animate={{ d: p.line }}
                    transition={{ d: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } }}
                    fill="none"
                    stroke={p.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              ))}

            {/* Crosshair */}
            {tip && hover !== null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={0} y2={innerH} stroke="var(--line-strong)" strokeWidth={1} />
                {tip.map(({ s, p }) =>
                  p.value === null ? null : (
                    <circle key={s.id} cx={x(hover)} cy={y(p.value)} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                  ),
                )}
              </g>
            )}

            <rect
              width={innerW}
              height={innerH}
              fill="transparent"
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={() => setHover(null)}
              style={{ touchAction: "pan-y" }}
            />
          </g>
        </svg>
      )}

      {!hasData && width > 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-6 text-[13px] text-fg-3">{emptyLabel}</div>
      )}

      <AnimatePresence>
        {tip && hover !== null && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-xl bg-surface px-3 py-2.5 shadow-lg"
            style={tipLeft ? { right: width - tipX + 14 } : { left: tipX + 14 }}
          >
            <p className="text-[12px] font-medium text-fg-2">{dayLabel(tip[0].p.date, { long: true, year: false })}</p>
            <div className="mt-1.5 space-y-1">
              {tip.map(({ s, p }) => (
                <div key={s.id} className="flex items-center justify-between gap-5 text-[12.5px]">
                  <span className="flex items-center gap-1.5 text-fg-3">
                    {series.length > 1 && <span className="size-2 rounded-full" style={{ background: s.color }} />}
                    {series.length > 1 ? s.label : valueLabel}
                  </span>
                  <span className="font-semibold text-fg tnum">{formatValue(p.value)}</span>
                </div>
              ))}
              {series.length === 1 && showChange && (
                <div className="flex items-center justify-between gap-5 text-[12.5px]">
                  <span className="text-fg-3">Change</span>
                  <span
                    className={cn(
                      "font-medium tnum",
                      (tip[0].p.change ?? 0) > 0 ? "text-positive" : (tip[0].p.change ?? 0) < 0 ? "text-negative" : "text-fg-3",
                    )}
                  >
                    {tip[0].p.change === null || tip[0].p.change === undefined ? "—" : signed(tip[0].p.change, full)}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Accessible data table */}
      <table className="sr-only">
        <caption>{valueLabel} by day</caption>
        <thead>
          <tr>
            <th>Date</th>
            {series.map((s) => (
              <th key={s.id}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series[0]?.points.map((p, i) => (
            <tr key={p.date}>
              <td>{p.date}</td>
              {series.map((s) => (
                <td key={s.id}>{formatValue(s.points[i]?.value ?? null)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

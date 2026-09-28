"use client";

import { useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { CalendarRange, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useRange } from "@/hooks/use-range";
import { RANGE_PRESETS, fmtShort } from "@/lib/range";
import { cn } from "@/lib/cn";
import { utcToKey } from "@/lib/dates";

const localKey = (d: Date) => utcToKey(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
const fromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export function RangeLabel() {
  const { range } = useRange();
  if (range.range === "custom" && range.from && range.to) return <>{`${fmtShort(range.from)} – ${fmtShort(range.to)}`}</>;
  return <>{RANGE_PRESETS.find((p) => p.key === range.range)?.label ?? "Last 30 days"}</>;
}

/** Date range control: quick presets + custom calendar. Updates the URL, which drives every query. */
export function RangePicker({ className }: { className?: string }) {
  const { range, setRange } = useRange();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState<DateRange | undefined>(
    range.range === "custom" && range.from && range.to ? { from: fromKey(range.from), to: fromKey(range.to) } : undefined,
  );
  const [showCal, setShowCal] = useState(range.range === "custom");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" className={cn("gap-2", className)} icon={<CalendarRange size={14} className="text-fg-3" />}>
          <span className="tnum">
            <RangeLabel />
          </span>
          <ChevronDown size={14} className="-mr-1 text-fg-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,320px)] p-2" align="end">
        <div className="grid grid-cols-3 gap-1">
          {RANGE_PRESETS.map((p) => {
            const active = range.range === p.key;
            return (
              <button
                key={p.key}
                onClick={() => {
                  setRange({ range: p.key });
                  setShowCal(false);
                  setOpen(false);
                }}
                className={cn(
                  "h-8 rounded-lg text-[12.5px] font-medium tnum transition-colors",
                  active ? "bg-accent-soft text-accent" : "text-fg-2 hover:bg-surface-hover hover:text-fg",
                )}
              >
                {p.short}
              </button>
            );
          })}
        </div>
        <div className="my-2 h-px bg-[var(--line)]" />
        <button
          onClick={() => setShowCal((s) => !s)}
          className={cn(
            "flex h-8 w-full items-center justify-between rounded-lg px-2.5 text-[12.5px] font-medium transition-colors",
            range.range === "custom" ? "text-accent" : "text-fg-2 hover:bg-surface-hover hover:text-fg",
          )}
        >
          Custom range
          <ChevronDown size={14} className={cn("transition-transform", showCal && "rotate-180")} />
        </button>
        {showCal && (
          <div className="px-1 pt-2">
            <DayPicker
              mode="range"
              selected={custom}
              onSelect={setCustom}
              disabled={{ after: new Date() }}
              defaultMonth={custom?.from ?? new Date()}
              numberOfMonths={1}
              weekStartsOn={1}
              showOutsideDays
            />
            <div className="flex items-center justify-between gap-2 px-1 pt-2 pb-1">
              <span className="text-[12px] text-fg-3 tnum">
                {custom?.from ? fmtShort(localKey(custom.from)) : "Start"} – {custom?.to ? fmtShort(localKey(custom.to)) : "End"}
              </span>
              <Button
                size="sm"
                variant="primary"
                disabled={!custom?.from || !custom?.to}
                onClick={() => {
                  if (!custom?.from || !custom.to) return;
                  setRange({ range: "custom", from: localKey(custom.from), to: localKey(custom.to) });
                  setOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Inline preset strip (7D · 30D · …) used above the main chart. */
export function RangeTabs({ className }: { className?: string }) {
  const { range, setRange } = useRange();
  return (
    <div className={cn("inline-flex items-center rounded-[10px] bg-surface-hover p-0.5", className)} role="tablist" aria-label="Time period">
      {RANGE_PRESETS.map((p) => {
        const active = range.range === p.key;
        return (
          <button
            key={p.key}
            role="tab"
            aria-selected={active}
            onClick={() => setRange({ range: p.key })}
            className={cn(
              "h-7 rounded-lg px-2.5 text-[12px] font-medium tnum transition-all duration-150",
              active ? "bg-surface text-fg shadow-[0_0_0_1px_var(--line),0_1px_2px_rgba(0,0,0,.06)]" : "text-fg-3 hover:text-fg-2",
            )}
          >
            {p.short}
          </button>
        );
      })}
    </div>
  );
}

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { pct } from "@/lib/format";

/** Growth indicator: quiet colored text + arrow. Null renders nothing (or a muted dash). */
export function Delta({ value, className, showNull, size = "md" }: { value: number | null | undefined; className?: string; showNull?: boolean; size?: "sm" | "md" | "lg" }) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return showNull ? <span className={cn("text-fg-4", className)}>—</span> : null;
  }
  const up = value > 0.05;
  const down = value < -0.05;
  const Icon = down ? ArrowDownRight : ArrowUpRight;
  const s = size === "lg" ? 15 : size === "sm" ? 11 : 13;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium tnum",
        up ? "text-positive" : down ? "text-negative" : "text-fg-3",
        size === "lg" ? "text-[14px]" : size === "sm" ? "text-[11.5px]" : "text-[12.5px]",
        className,
      )}
    >
      {(up || down) && <Icon size={s} strokeWidth={2.2} className="-ml-0.5" />}
      {pct(value)}
    </span>
  );
}

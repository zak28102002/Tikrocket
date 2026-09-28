import type { AccountStatusKey } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/tooltip";

const META: Record<AccountStatusKey, { label: string; dot: string; text: string }> = {
  HEALTHY: { label: "Healthy", dot: "bg-positive", text: "text-fg-2" },
  SYNCING: { label: "Updating", dot: "bg-accent animate-pulse-dot", text: "text-fg-2" },
  PENDING: { label: "Collecting data", dot: "bg-accent animate-pulse-dot", text: "text-fg-2" },
  ERROR: { label: "Needs attention", dot: "bg-negative", text: "text-negative" },
  UNAVAILABLE: { label: "Data unavailable", dot: "bg-fg-4", text: "text-fg-3" },
  PAUSED: { label: "Paused", dot: "bg-fg-4", text: "text-fg-3" },
};

export function StatusBadge({ status, message, className }: { status: AccountStatusKey; message?: string | null; className?: string }) {
  const m = META[status];
  const el = (
    <span className={cn("inline-flex items-center gap-1.5 text-[12.5px] whitespace-nowrap", m.text, className)}>
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
  return message && (status === "ERROR" || status === "UNAVAILABLE") ? <Tooltip content={message}>{el}</Tooltip> : el;
}

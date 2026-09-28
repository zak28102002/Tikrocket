"use client";

import { useState, type ReactNode } from "react";
import { CloudOff } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-6 py-10" : "px-6 py-20", className)}>
      {icon && (
        <div className="relative mb-5">
          <div className="absolute inset-0 -m-3 rounded-[22px] bg-accent-softer" />
          <div className="relative flex size-12 items-center justify-center rounded-[14px] bg-surface text-fg-2 shadow-[0_0_0_1px_var(--line),0_4px_12px_-4px_rgba(0,0,0,.08)]">
            {icon}
          </div>
        </div>
      )}
      <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-fg-3">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Couldn't load this",
  message = "Something went wrong while loading. It's usually temporary.",
  detail,
  onRetry,
  className,
  compact,
}: {
  title?: string;
  message?: string;
  detail?: string | null;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-6 py-8" : "px-6 py-16", className)}>
      <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-surface-hover text-fg-3">
        <CloudOff size={18} strokeWidth={1.75} />
      </div>
      <h3 className="text-[14px] font-semibold text-fg">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-fg-3">{message}</p>
      <div className="mt-4 flex gap-2">
        {onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        )}
        {detail && (
          <Button size="sm" variant="ghost" onClick={() => setShow((s) => !s)}>
            {show ? "Hide details" : "View details"}
          </Button>
        )}
      </div>
      {show && detail && (
        <pre className="mt-4 max-w-lg overflow-x-auto rounded-lg bg-surface-hover px-3 py-2 text-left font-mono text-[11px] whitespace-pre-wrap text-fg-2">
          {detail}
        </pre>
      )}
    </div>
  );
}

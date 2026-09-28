"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { RangePicker } from "./range-picker";
import { Notifications } from "./notifications";
import { UserMenu } from "./sidebar";
import { useShell } from "./app-shell";
import { Avatar } from "@/components/ui/avatar";
import { useViewer } from "@/components/providers";
import { cn } from "@/lib/cn";

/** Consistent page header: title + context on the left, global controls on the right. */
export function PageHeader({
  title,
  description,
  leading,
  actions,
  showRange = true,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  showRange?: boolean;
  className?: string;
}) {
  const viewer = useViewer();
  const { openSearch } = useShell();
  return (
    <header className={cn("flex flex-col gap-4 pb-8 md:flex-row md:items-end md:justify-between", className)}>
      <div className="flex min-w-0 items-center gap-4">
        {leading}
        <div className="min-w-0">
          <h1 className="display truncate text-[26px] leading-[1.15] font-semibold text-fg md:text-[28px]">{title}</h1>
          {description && <p className="mt-1 text-[14px] text-fg-3">{description}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:justify-end">
        {actions}
        {showRange && <RangePicker />}
        <button
          onClick={openSearch}
          className="hidden h-8 items-center gap-2 rounded-lg px-2.5 text-[13px] text-fg-3 shadow-[0_0_0_1px_var(--line-strong)] transition-colors hover:bg-surface-hover hover:text-fg-2 md:inline-flex"
          aria-label="Search"
        >
          <Search size={14} />
          <span className="hidden xl:inline">Search</span>
          <kbd className="ml-1 hidden rounded bg-surface-hover px-1 font-sans text-[10.5px] text-fg-3 xl:inline">⌘K</kbd>
        </button>
        <div className="hidden md:block">
          <Notifications />
        </div>
        <UserMenu
          align="end"
          trigger={
            <button className="hidden rounded-full transition-opacity hover:opacity-85 md:block" aria-label="Account menu">
              <Avatar name={viewer.user.name} url={viewer.user.avatarUrl} size={28} />
            </button>
          }
        />
      </div>
    </header>
  );
}

/** Section heading inside a page. */
export function SectionHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-fg-3">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

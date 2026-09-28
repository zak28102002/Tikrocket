"use client";

import type { ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "./menu";
import { cn } from "@/lib/cn";

/** Dropdown filter pill. Active state shows the value and a one-click clear. */
export function FilterPill<T extends string>({
  label,
  value,
  options,
  onChange,
  allLabel,
  icon,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  onChange: (v: T | null) => void;
  allLabel?: string;
  icon?: ReactNode;
}) {
  const active = value !== null && value !== undefined;
  const current = options.find((o) => o.value === value);
  return (
    <div
      className={cn(
        "inline-flex h-8 items-center rounded-full text-[12.5px] transition-colors",
        active ? "bg-accent-soft text-accent" : "text-fg-2 shadow-[0_0_0_1px_var(--line-strong)] hover:bg-surface-hover",
      )}
    >
      <Menu>
        <MenuTrigger asChild>
          <button className={cn("flex h-full items-center gap-1.5 font-medium", active ? "pl-3 pr-1.5" : "px-3")}>
            {icon}
            {active ? (
              <>
                <span className="opacity-70">{label}:</span> {current?.label}
              </>
            ) : (
              <>
                {allLabel ?? label}
                <ChevronDown size={13} className="text-fg-3" />
              </>
            )}
          </button>
        </MenuTrigger>
        <MenuContent align="start">
          {allLabel && (
            <MenuItem checked={!active} onSelect={() => onChange(null)}>
              {allLabel}
            </MenuItem>
          )}
          {options.map((o) => (
            <MenuItem key={o.value} icon={o.icon} checked={o.value === value} onSelect={() => onChange(o.value)}>
              {o.label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      {active && (
        <button onClick={() => onChange(null)} className="mr-1.5 flex size-5 items-center justify-center rounded-full transition-colors hover:bg-accent-soft" aria-label={`Clear ${label} filter`}>
          <X size={12} />
        </button>
      )}
    </div>
  );
}

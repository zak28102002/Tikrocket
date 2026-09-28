"use client";

import * as M from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;

export function MenuContent({ children, align = "end", className, width }: { children: ReactNode; align?: "start" | "end" | "center"; className?: string; width?: number }) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={6}
        className={cn("menu-anim z-50 min-w-44 rounded-xl bg-surface p-1 shadow-lg", className)}
        style={width ? { width } : undefined}
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  icon,
  danger,
  checked,
  shortcut,
  disabled,
}: {
  children: ReactNode;
  onSelect?: () => void;
  icon?: ReactNode;
  danger?: boolean;
  checked?: boolean;
  shortcut?: string;
  disabled?: boolean;
}) {
  return (
    <M.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex h-8 cursor-default select-none items-center gap-2.5 rounded-md px-2 text-[13px] outline-none transition-colors",
        "data-[highlighted]:bg-surface-hover data-[disabled]:opacity-40",
        danger ? "text-negative" : "text-fg",
      )}
    >
      {icon && <span className={cn("flex size-4 items-center justify-center", danger ? "text-negative" : "text-fg-3")}>{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <span className="text-[11px] text-fg-4">{shortcut}</span>}
      {checked !== undefined && <Check size={14} className={cn("text-accent", !checked && "invisible")} />}
    </M.Item>
  );
}

export const MenuSeparator = () => <M.Separator className="-mx-1 my-1 h-px bg-[var(--line)]" />;
export const MenuLabel = ({ children }: { children: ReactNode }) => (
  <M.Label className="px-2 pt-1.5 pb-1 text-[11px] font-medium text-fg-3">{children}</M.Label>
);

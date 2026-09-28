"use client";

import * as P from "@radix-ui/react-popover";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverClose = P.Close;

export function PopoverContent({ children, align = "end", className }: { children: ReactNode; align?: "start" | "end" | "center"; className?: string }) {
  return (
    <P.Portal>
      <P.Content align={align} sideOffset={6} collisionPadding={12} className={cn("menu-anim z-50 rounded-xl bg-surface shadow-lg outline-none", className)}>
        {children}
      </P.Content>
    </P.Portal>
  );
}

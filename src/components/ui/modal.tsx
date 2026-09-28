"use client";

import * as D from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/** Centered modal with a soft spring entrance. Controlled via `open`. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  width = 480,
  hideClose,
  dismissable = true,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  width?: number;
  hideClose?: boolean;
  dismissable?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={(o) => (dismissable || o ? onOpenChange(o) : undefined)}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-[var(--overlay)] backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </D.Overlay>
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[12vh] sm:pt-[14vh]">
              <D.Content asChild forceMount onEscapeKeyDown={(e) => !dismissable && e.preventDefault()} onPointerDownOutside={(e) => !dismissable && e.preventDefault()}>
                <motion.div
                  className="relative w-full rounded-2xl bg-surface shadow-lg outline-none"
                  style={{ maxWidth: width }}
                  initial={{ opacity: 0, y: 10, scale: 0.975 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.985, transition: { duration: 0.12 } }}
                  transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
                >
                  {(title || !hideClose) && (
                    <div className={cn("flex items-start justify-between gap-4 px-6 pt-5", !title && "absolute right-0 top-0 z-10")}>
                      <div className="min-w-0">
                        {title && <D.Title className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</D.Title>}
                        {description ? (
                          <D.Description className="mt-1 text-[13px] text-fg-3">{description}</D.Description>
                        ) : (
                          <D.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</D.Description>
                        )}
                      </div>
                      {!hideClose && (
                        <D.Close className="-mr-2 -mt-1 flex size-7 items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-surface-hover hover:text-fg" aria-label="Close">
                          <X size={16} strokeWidth={1.75} />
                        </D.Close>
                      )}
                    </div>
                  )}
                  {!title && <D.Title className="sr-only">Dialog</D.Title>}
                  {children}
                </motion.div>
              </D.Content>
            </div>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}

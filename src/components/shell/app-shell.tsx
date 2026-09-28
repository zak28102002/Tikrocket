"use client";

import * as D from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { createContext, Suspense, useContext, useEffect, useState, type ReactNode } from "react";
import { Menu as MenuIcon, Search } from "lucide-react";
import { Providers } from "@/components/providers";
import type { ViewerInfo } from "@/lib/types";
import { Sidebar, SidebarContents } from "./sidebar";
import { CommandPalette } from "./command-palette";
import { ModalProvider } from "./modals";
import { Notifications } from "./notifications";
import { Logo } from "@/components/ui/logo";
import { IconButton } from "@/components/ui/button";

const ShellCtx = createContext<{ openSearch: () => void }>({ openSearch: () => {} });
export const useShell = () => useContext(ShellCtx);

function MobileBar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  return (
    <div className="sticky top-0 z-20 flex h-14 items-center justify-between bg-[var(--bg)]/85 px-3 backdrop-blur-md hairline-b lg:hidden">
      <div className="flex items-center gap-1">
        <IconButton label="Open navigation" onClick={onMenu}>
          <MenuIcon size={18} strokeWidth={1.75} />
        </IconButton>
        <Logo />
      </div>
      <div className="flex items-center gap-0.5">
        <IconButton label="Search" onClick={onSearch}>
          <Search size={16} strokeWidth={1.75} />
        </IconButton>
        <Notifications />
      </div>
    </div>
  );
}

function Drawer({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-40 bg-[var(--overlay)] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </D.Overlay>
            <D.Content asChild forceMount>
              <motion.div
                className="fixed inset-y-0 left-0 z-50 w-[272px] max-w-[85vw] bg-[var(--bg)] shadow-lg outline-none lg:hidden"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 420, damping: 40 }}
              >
                <D.Title className="sr-only">Navigation</D.Title>
                <SidebarContents onNavigate={() => onOpenChange(false)} />
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}

export function AppShell({ viewer, children }: { viewer: ViewerInfo; children: ReactNode }) {
  const [search, setSearch] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Providers viewer={viewer}>
      <ShellCtx.Provider value={{ openSearch: () => setSearch(true) }}>
        <ModalProvider>
          <Suspense>
            <Sidebar />
          </Suspense>
          <div className="min-h-dvh lg:pl-[248px]">
            <MobileBar onMenu={() => setDrawer(true)} onSearch={() => setSearch(true)} />
            <div className="min-h-dvh lg:py-2 lg:pr-2">
              <main className="min-h-[calc(100dvh-16px)] bg-surface lg:rounded-[18px] lg:shadow-[0_0_0_1px_var(--line),0_1px_3px_rgba(0,0,0,.03)]">
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="mx-auto w-full max-w-[1320px] px-4 pt-6 pb-16 sm:px-6 md:pt-9 lg:px-10"
                >
                  <Suspense>{children}</Suspense>
                </motion.div>
              </main>
            </div>
          </div>
          <Drawer open={drawer} onOpenChange={setDrawer} />
          <Suspense>
            <CommandPalette open={search} onOpenChange={setSearch} />
          </Suspense>
        </ModalProvider>
      </ShellCtx.Provider>
    </Providers>
  );
}

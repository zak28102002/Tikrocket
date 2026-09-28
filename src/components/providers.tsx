"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast";
import type { ViewerInfo } from "@/lib/types";
import { ApiError } from "@/lib/api";

const ViewerCtx = createContext<ViewerInfo | null>(null);
export function useViewer() {
  const v = useContext(ViewerCtx);
  if (!v) throw new Error("useViewer outside provider");
  return v;
}
export const useCan = () => {
  const { role } = useViewer();
  return { edit: role !== "VIEWER", admin: role === "ADMIN" };
};

export type ThemePref = "system" | "light" | "dark";
const ThemeCtx = createContext<{ pref: ThemePref; setPref: (p: ThemePref) => void }>({ pref: "system", setPref: () => {} });
export const useTheme = () => useContext(ThemeCtx);

function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>("system");
  useEffect(() => {
    try {
      // Browser-only preference, read after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrefState((localStorage.getItem("pulse-theme") as ThemePref) || "system");
    } catch {}
  }, []);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = pref === "dark" || (pref === "system" && mq.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [pref]);
  const setPref = (p: ThemePref) => {
    setPrefState(p);
    try {
      localStorage.setItem("pulse-theme", p);
    } catch {}
  };
  return <ThemeCtx.Provider value={{ pref, setPref }}>{children}</ThemeCtx.Provider>;
}

export function Providers({ children, viewer }: { children: ReactNode; viewer?: ViewerInfo }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: true,
            retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <TooltipProvider>
          <ToastProvider>{viewer ? <ViewerCtx.Provider value={viewer}>{children}</ViewerCtx.Provider> : children}</ToastProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

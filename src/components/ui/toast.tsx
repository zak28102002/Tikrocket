"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

type Toast = { id: number; title: string; description?: string; tone?: "success" | "error" | "info" };
const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.14 } }}
              transition={{ type: "spring", stiffness: 460, damping: 34 }}
              className="pointer-events-auto flex gap-3 rounded-xl bg-surface px-3.5 py-3 shadow-lg"
              role="status"
            >
              {t.tone === "error" ? (
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-negative" />
              ) : (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-positive" />
              )}
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-fg">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[12.5px] text-fg-3">{t.description}</p>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

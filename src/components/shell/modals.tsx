"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { NewAppModal } from "@/components/pulse/new-app-modal";
import { AddAccountModal } from "@/components/pulse/add-account-modal";

type Ctx = { newApp: () => void; addAccount: (appId: string) => void };
const ModalCtx = createContext<Ctx>({ newApp: () => {}, addAccount: () => {} });
export const useModals = () => useContext(ModalCtx);

/** App-wide creation flows, openable from anywhere (pages, ⌘K). */
export function ModalProvider({ children }: { children: ReactNode }) {
  const [newApp, setNewApp] = useState(false);
  const [accountFor, setAccountFor] = useState<string | null>(null);
  // Bumped on every open so each flow starts from a clean state.
  const [session, setSession] = useState(0);
  const openNewApp = useCallback(() => {
    setSession((s) => s + 1);
    setNewApp(true);
  }, []);
  const openAddAccount = useCallback((appId: string) => {
    setSession((s) => s + 1);
    setAccountFor(appId);
  }, []);
  return (
    <ModalCtx.Provider value={{ newApp: openNewApp, addAccount: openAddAccount }}>
      {children}
      <NewAppModal key={`app-${session}`} open={newApp} onOpenChange={setNewApp} />
      <AddAccountModal key={`acct-${session}`} appId={accountFor} onClose={() => setAccountFor(null)} />
    </ModalCtx.Provider>
  );
}

"use client";

import { Command } from "cmdk";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AtSign, Boxes, ChartSpline, Clapperboard, CornerDownLeft, LayoutGrid, Moon, Plus, Search, Settings, Sun } from "lucide-react";
import { api } from "@/lib/api";
import type { SearchResponse } from "@/lib/types";
import { AppIcon, Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { useCan, useTheme } from "@/components/providers";
import { compact } from "@/lib/format";
import { PLATFORM_META } from "@/lib/platforms";
import { useModals } from "./modals";

function useDebounced<T>(value: T, ms = 160) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Item({ children, onSelect, value, icon, hint }: { children: ReactNode; onSelect: () => void; value: string; icon?: ReactNode; hint?: ReactNode }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="group flex h-10 cursor-default items-center gap-3 rounded-lg px-2.5 text-[13.5px] text-fg outline-none data-[selected=true]:bg-surface-hover"
    >
      {icon && <span className="flex size-6 shrink-0 items-center justify-center text-fg-3">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-[12px] text-fg-3 tnum">{hint}</span>}
      <CornerDownLeft size={13} className="shrink-0 text-fg-4 opacity-0 group-data-[selected=true]:opacity-100" />
    </Command.Item>
  );
}

const group = "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-3";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const term = useDebounced(q.trim());
  const { pref, setPref } = useTheme();
  const can = useCan();
  const modals = useModals();

  const res = useQuery({
    queryKey: ["search", term],
    queryFn: () => api<SearchResponse>(`/api/v1/search?q=${encodeURIComponent(term)}`),
    enabled: open && term.length > 0,
    placeholderData: (prev) => prev,
  });

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const data = term ? res.data : undefined;
  const nothing = term && data && !data.apps.length && !data.accounts.length && !data.posts.length;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setQ("");
        onOpenChange(o);
      }}
      label="Search Pulse"
      shouldFilter={!term}
      loop
      overlayClassName="fixed inset-0 z-40 bg-[var(--overlay)] backdrop-blur-[2px] data-[state=open]:animate-[fade-in_.15s_ease-out]"
      contentClassName="fixed left-1/2 top-[14vh] z-50 w-[min(640px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl bg-surface shadow-lg data-[state=open]:animate-[palette-in_.18s_cubic-bezier(.22,1,.36,1)]"
    >
      <div className="flex h-14 items-center gap-3 px-4 hairline-b">
        <Search size={17} strokeWidth={1.75} className="text-fg-3" />
        <Command.Input
          value={q}
          onValueChange={setQ}
          placeholder="Search apps, accounts and content…"
          className="h-full flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-4"
        />
        {res.isFetching && term ? <Spinner size={14} className="text-fg-3" /> : <kbd className="rounded-md bg-surface-hover px-1.5 py-0.5 text-[11px] text-fg-3">esc</kbd>}
      </div>
      <Command.List className="max-h-[min(440px,60vh)] overflow-y-auto p-2 [scrollbar-width:thin]">
        {nothing && <div className="py-12 text-center text-[13px] text-fg-3">No results for “{term}”</div>}

        {data && data.apps.length > 0 && (
          <Command.Group heading="Apps" className={group}>
            {data.apps.map((a) => (
              <Item key={a.id} value={`app-${a.id}`} onSelect={() => go(`/apps/${a.id}`)} icon={<AppIcon name={a.name} url={a.iconUrl} seed={a.iconSeed} size={22} />}>
                {a.name}
              </Item>
            ))}
          </Command.Group>
        )}
        {data && data.accounts.length > 0 && (
          <Command.Group heading="Accounts" className={group}>
            {data.accounts.map((a) => (
              <Item
                key={a.id}
                value={`acct-${a.id}`}
                onSelect={() => go(`/accounts/${a.id}`)}
                icon={<Avatar name={a.username} url={a.avatarUrl} size={22} platform={a.platform} />}
                hint={`${PLATFORM_META[a.platform].label} · ${a.app.name}`}
              >
                @{a.username}
              </Item>
            ))}
          </Command.Group>
        )}
        {data && data.posts.length > 0 && (
          <Command.Group heading="Content" className={group}>
            {data.posts.map((p) => (
              <Item
                key={p.id}
                value={`post-${p.id}`}
                onSelect={() => go(`/content/${p.id}`)}
                icon={
                  p.thumbnailUrl ? (
                    <img src={p.thumbnailUrl} alt="" className="h-6 w-[14px] rounded-[3px] object-cover" />
                  ) : (
                    <Clapperboard size={15} />
                  )
                }
                hint={`${compact(p.views)} views`}
              >
                {p.caption || "Untitled post"}
              </Item>
            ))}
          </Command.Group>
        )}

        {!term && (
          <>
            <Command.Group heading="Go to" className={group}>
              <Item value="overview" onSelect={() => go("/")} icon={<LayoutGrid size={15} />}>Overview</Item>
              <Item value="apps" onSelect={() => go("/apps")} icon={<Boxes size={15} />}>Apps</Item>
              <Item value="accounts" onSelect={() => go("/accounts")} icon={<AtSign size={15} />}>Accounts</Item>
              <Item value="content" onSelect={() => go("/content")} icon={<Clapperboard size={15} />}>Content</Item>
              <Item value="analytics" onSelect={() => go("/analytics")} icon={<ChartSpline size={15} />}>Analytics</Item>
              <Item value="settings" onSelect={() => go("/settings")} icon={<Settings size={15} />}>Settings</Item>
            </Command.Group>
            <Command.Group heading="Actions" className={group}>
              {can.edit && (
                <Item
                  value="new app"
                  onSelect={() => {
                    onOpenChange(false);
                    modals.newApp();
                  }}
                  icon={<Plus size={15} />}
                >
                  New app
                </Item>
              )}
              <Item
                value="toggle theme"
                onSelect={() => {
                  setPref(pref === "dark" ? "light" : "dark");
                  onOpenChange(false);
                }}
                icon={pref === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              >
                Switch to {pref === "dark" ? "light" : "dark"} mode
              </Item>
            </Command.Group>
          </>
        )}
      </Command.List>
    </Command.Dialog>
  );
}

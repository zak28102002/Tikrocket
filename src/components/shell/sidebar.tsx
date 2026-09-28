"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  Check,
  ChevronsUpDown,
  Clapperboard,
  LayoutGrid,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  Boxes,
  ChartSpline,
} from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useTheme, useViewer } from "@/components/providers";
import { useRangeHref } from "@/hooks/use-range";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/apps", label: "Apps", icon: Boxes },
  { href: "/accounts", label: "Accounts", icon: AtSign },
  { href: "/content", label: "Content", icon: Clapperboard },
  { href: "/analytics", label: "Analytics", icon: ChartSpline },
];

function NavLink({ href, label, icon: Icon, onNavigate }: { href: string; label: string; icon: typeof LayoutGrid; onNavigate?: () => void }) {
  const pathname = usePathname();
  const withRange = useRangeHref();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href === "/settings" ? href : withRange(href)}
      onClick={onNavigate}
      className={cn(
        "group relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors duration-150",
        active ? "text-fg font-medium" : "text-fg-2 hover:text-fg hover:bg-surface-hover",
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-lg bg-surface shadow-[0_0_0_1px_var(--line),0_1px_2px_rgba(0,0,0,.04)]"
          transition={{ type: "spring", stiffness: 520, damping: 40 }}
        />
      )}
      <Icon size={16} strokeWidth={1.75} className={cn("relative z-10 shrink-0", active ? "text-accent" : "text-fg-3 group-hover:text-fg-2")} />
      <span className="relative z-10">{label}</span>
    </Link>
  );
}

export function UserMenu({ trigger, align = "start" }: { trigger: ReactNode; align?: "start" | "end" }) {
  const viewer = useViewer();
  const { pref, setPref } = useTheme();
  const router = useRouter();
  return (
    <Menu>
      <MenuTrigger asChild>{trigger}</MenuTrigger>
      <MenuContent align={align} width={232}>
        <div className="px-2 py-2">
          <p className="truncate text-[13px] font-medium text-fg">{viewer.user.name}</p>
          <p className="truncate text-[12px] text-fg-3">{viewer.user.email}</p>
        </div>
        <MenuSeparator />
        <MenuLabel>Theme</MenuLabel>
        <MenuItem icon={<Monitor size={14} />} checked={pref === "system"} onSelect={() => setPref("system")}>
          System
        </MenuItem>
        <MenuItem icon={<Sun size={14} />} checked={pref === "light"} onSelect={() => setPref("light")}>
          Light
        </MenuItem>
        <MenuItem icon={<Moon size={14} />} checked={pref === "dark"} onSelect={() => setPref("dark")}>
          Dark
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Settings size={14} />} onSelect={() => router.push("/settings")}>
          Settings
        </MenuItem>
        <MenuItem
          icon={<LogOut size={14} />}
          onSelect={async () => {
            await api("/api/v1/auth/logout", { method: "POST" });
            // Full reload on sign-out clears every client cache.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = "/login";
          }}
        >
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function WorkspaceSwitcher() {
  const viewer = useViewer();
  const qc = useQueryClient();
  const router = useRouter();
  const switchTo = async (id: string) => {
    if (id === viewer.workspace.id) return;
    await api("/api/v1/workspace/switch", { method: "POST", json: { workspaceId: id } });
    qc.clear();
    router.push("/");
    router.refresh();
  };
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-hover">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-fg text-[11px] font-semibold text-[var(--fg-inverse)]">
            {viewer.workspace.name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-fg">{viewer.workspace.name}</span>
            {viewer.workspace.isDemo && <span className="block text-[11px] text-warning">Demo data</span>}
          </span>
          <ChevronsUpDown size={14} className="shrink-0 text-fg-3" />
        </button>
      </MenuTrigger>
      <MenuContent align="start" width={232}>
        <MenuLabel>Workspaces</MenuLabel>
        {viewer.workspaces.map((w) => (
          <MenuItem key={w.id} onSelect={() => switchTo(w.id)} icon={w.id === viewer.workspace.id ? <Check size={14} className="text-accent" /> : <span />}>
            <span className="flex items-center gap-2">
              {w.name}
              {w.isDemo && <span className="rounded bg-warning-soft px-1 py-px text-[10.5px] font-medium text-warning">Demo</span>}
            </span>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

export function SidebarContents({ onNavigate }: { onNavigate?: () => void }) {
  const viewer = useViewer();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <Link href="/" onClick={onNavigate} aria-label="Pulse home">
          <Logo />
        </Link>
      </div>
      <nav className="flex flex-col gap-0.5 px-2.5 pt-2" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.href} {...n} onNavigate={onNavigate} />
        ))}
        <div className="mx-2.5 my-3 h-px bg-[var(--line)]" />
        <NavLink href="/settings" label="Settings" icon={Settings} onNavigate={onNavigate} />
      </nav>
      <div className="mt-auto space-y-1 p-2.5">
        <WorkspaceSwitcher />
        <UserMenu
          trigger={
            <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-hover">
              <Avatar name={viewer.user.name} url={viewer.user.avatarUrl} size={24} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg-2">{viewer.user.name}</span>
            </button>
          }
        />
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] lg:block">
      <SidebarContents />
    </aside>
  );
}

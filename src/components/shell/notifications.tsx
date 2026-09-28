"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconButton } from "@/components/ui/button";
import { ActivityFeed, ActivitySkeleton } from "@/components/pulse/activity-feed";
import { api } from "@/lib/api";
import type { ActivityItem } from "@/lib/types";

const SEEN_KEY = "pulse-activity-seen";

export function Notifications() {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Hydration-safe read of browser-only state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    try {
      setSeen(localStorage.getItem(SEEN_KEY));
    } catch {}
  }, []);
  const q = useQuery({
    queryKey: ["activity", "bell"],
    queryFn: () => api<{ items: ActivityItem[] }>("/api/v1/activity?limit=12"),
    refetchInterval: 60_000,
  });
  const latest = q.data?.items[0]?.createdAt ?? null;
  const unread = mounted && latest !== null && (seen === null || latest > seen);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && latest) {
          setSeen(latest);
          try {
            localStorage.setItem(SEEN_KEY, latest);
          } catch {}
        }
      }}
    >
      <PopoverTrigger asChild>
        <IconButton label="Notifications" className="relative">
          <Bell size={16} strokeWidth={1.75} />
          {unread && <span className="absolute top-[7px] right-[8px] size-1.5 rounded-full bg-accent ring-2 ring-[var(--bg)]" />}
        </IconButton>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,360px)]">
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <p className="text-[13px] font-semibold text-fg">Activity</p>
        </div>
        <div className="max-h-[420px] overflow-y-auto px-2 pb-2">
          {q.isLoading ? (
            <div className="px-2">
              <ActivitySkeleton rows={4} />
            </div>
          ) : q.data?.items.length ? (
            <ActivityFeed items={q.data.items} compact onNavigate={() => setOpen(false)} />
          ) : (
            <p className="px-2 py-8 text-center text-[13px] text-fg-3">Nothing new yet. Activity appears as accounts update.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

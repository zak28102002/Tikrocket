"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { PlatformKey } from "@/lib/profile-url";
import { PlatformIcon } from "./platform-icon";

const GRADIENTS = [
  ["#5b6cff", "#2a36b8"],
  ["#ff7a59", "#d9401f"],
  ["#22c28a", "#0e7d57"],
  ["#f5b62f", "#d27d00"],
  ["#e26aa6", "#a3286a"],
  ["#43b0f1", "#1564b0"],
  ["#8f7bff", "#5436d6"],
  ["#1f2937", "#030712"],
  ["#34d399", "#047857"],
  ["#fb7185", "#be123c"],
  ["#a3a3a3", "#404040"],
  ["#f97316", "#9a3412"],
];

/** App icon: uploaded image, or a generated monogram tile. iOS-style continuous corners. */
export function AppIcon({
  name,
  url,
  seed = 0,
  size = 32,
  className,
}: {
  name: string;
  url?: string | null;
  seed?: number;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const radius = Math.round(size * 0.26);
  const [a, b] = GRADIENTS[Math.abs(seed) % GRADIENTS.length];
  const style = { width: size, height: size, borderRadius: radius };
  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        onError={() => setFailed(true)}
        className={cn("shrink-0 object-cover shadow-[0_0_0_1px_var(--line)]", className)}
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center font-semibold text-white display", className)}
      style={{
        ...style,
        background: `linear-gradient(145deg, ${a}, ${b})`,
        fontSize: size * 0.44,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.22), 0 0 0 1px rgba(0,0,0,.04)",
      }}
    >
      {name.trim().charAt(0).toUpperCase() || "A"}
    </span>
  );
}

/** Circular profile picture with an optional platform badge. */
export function Avatar({
  url,
  name,
  size = 32,
  platform,
  className,
}: {
  url?: string | null;
  name: string;
  size?: number;
  platform?: PlatformKey;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const seed = [...name].reduce((s, c) => s + c.charCodeAt(0), 0);
  const [a, b] = GRADIENTS[seed % GRADIENTS.length];
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      {url && !failed ? (
        <img
          src={url}
          alt=""
          onError={() => setFailed(true)}
          className="size-full rounded-full object-cover shadow-[0_0_0_1px_var(--line)]"
        />
      ) : (
        <span
          className="flex size-full items-center justify-center rounded-full font-semibold text-white"
          style={{ background: `linear-gradient(145deg, ${a}, ${b})`, fontSize: size * 0.4 }}
          aria-hidden
        >
          {name.replace(/^@/, "").charAt(0).toUpperCase()}
        </span>
      )}
      {platform && (
        <span
          className="absolute -right-0.5 -bottom-0.5 flex items-center justify-center rounded-full bg-surface text-fg shadow-[0_0_0_1px_var(--line)]"
          style={{ width: Math.max(14, size * 0.42), height: Math.max(14, size * 0.42) }}
        >
          <PlatformIcon platform={platform} size={Math.max(8, size * 0.24)} />
        </span>
      )}
    </span>
  );
}

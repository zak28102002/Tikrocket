import type { PlatformKey } from "@/lib/profile-url";
import { PLATFORM_META } from "@/lib/platforms";
import { cn } from "@/lib/cn";

/** Monochrome platform glyphs. Deliberately small and quiet. */
export function PlatformIcon({ platform, size = 14, className }: { platform: PlatformKey; size?: number; className?: string }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", className: cn("shrink-0", className), "aria-hidden": true };
  if (platform === "TIKTOK") {
    return (
      <svg {...common} fill="currentColor">
        <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    );
  }
  if (platform === "INSTAGRAM") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.1">
        <rect x="3" y="3" width="18" height="18" rx="5.2" />
        <circle cx="12" cy="12" r="4.1" />
        <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="currentColor">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
    </svg>
  );
}

/** Glyph + label, e.g. in rows and cards. */
export function PlatformLabel({ platform, className, iconOnly }: { platform: PlatformKey; className?: string; iconOnly?: boolean }) {
  const meta = PLATFORM_META[platform];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-fg-2", className)} title={meta.label}>
      <PlatformIcon platform={platform} size={13} className="opacity-80" />
      {!iconOnly && <span>{meta.label}</span>}
    </span>
  );
}

/** Tiny hue dot for legends and dense rows. */
export function PlatformDot({ platform, className }: { platform: PlatformKey; className?: string }) {
  return (
    <span
      className={cn("inline-block size-1.5 rounded-full", className)}
      style={{ background: PLATFORM_META[platform].hue }}
      aria-hidden
    />
  );
}

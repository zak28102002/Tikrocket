import { cn } from "@/lib/cn";

/** Pulse mark: a single rising pulse stroke in a soft square. */
export function LogoMark({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect width="24" height="24" rx="7" fill="currentColor" />
      <path
        d="M5 14.5h3.2l2.1-4.6 3.1 6.6 2.5-8.5h3.1"
        stroke="var(--surface)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-fg select-none", className)}>
      <LogoMark />
      <span className="display text-[17px] font-semibold leading-none tracking-[-0.045em]">pulse</span>
    </span>
  );
}

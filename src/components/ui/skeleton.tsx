import { cn } from "@/lib/cn";
import type { CSSProperties } from "react";

/** A span (block by default) so skeletons are valid inside headings and paragraphs. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span className={cn("skeleton", !className?.includes("inline") && "block", className)} style={style} aria-hidden />;
}

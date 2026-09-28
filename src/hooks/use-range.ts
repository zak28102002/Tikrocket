"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { parseRangeInput, rangeToSearch, type RangeInput } from "@/lib/range";

/** Date range lives in the URL so views are shareable and drive query keys. */
export function useRange() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const range = useMemo(
    () => parseRangeInput({ range: sp.get("range"), from: sp.get("from"), to: sp.get("to") }),
    [sp],
  );
  const setRange = useCallback(
    (r: RangeInput) => {
      const next = new URLSearchParams(sp.toString());
      next.delete("range");
      next.delete("from");
      next.delete("to");
      for (const [k, v] of new URLSearchParams(rangeToSearch(r))) next.set(k, v);
      if (r.range === "30d") next.delete("range");
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [sp, router, pathname],
  );
  return { range, setRange, qs: rangeToSearch(range) };
}

/** Generic URL param state (filters). */
export function useParamState() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const set = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [sp, router, pathname],
  );
  return { params: sp, set };
}

/** Preserve the current range when linking to another page. */
export function useRangeHref() {
  const sp = useSearchParams();
  return useCallback(
    (href: string) => {
      const keep = new URLSearchParams();
      for (const k of ["range", "from", "to"]) {
        const v = sp.get(k);
        if (v) keep.set(k, v);
      }
      const qs = keep.toString();
      return qs ? `${href}${href.includes("?") ? "&" : "?"}${qs}` : href;
    },
    [sp],
  );
}

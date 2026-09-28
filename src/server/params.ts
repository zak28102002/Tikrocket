import type { NextRequest } from "next/server";
import { parseRangeInput } from "@/lib/range";

export const rangeFrom = (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  return parseRangeInput({ range: sp.get("range"), from: sp.get("from"), to: sp.get("to") });
};

const PLATFORM_SET = new Set(["TIKTOK", "INSTAGRAM", "YOUTUBE"]);
export const platformFrom = (req: NextRequest) => {
  const p = req.nextUrl.searchParams.get("platform")?.toUpperCase();
  return p && PLATFORM_SET.has(p) ? (p as "TIKTOK" | "INSTAGRAM" | "YOUTUBE") : undefined;
};
export const str = (req: NextRequest, k: string) => req.nextUrl.searchParams.get(k) || undefined;

export const clientIp = (req: NextRequest) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";

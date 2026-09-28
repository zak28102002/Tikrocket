import { NextResponse, type NextRequest } from "next/server";

/** Cheap gate: bounce visitors without a session cookie to /login. Real checks happen server-side. */
export function proxy(req: NextRequest) {
  const has = req.cookies.has("pulse_session");
  if (!has) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = req.nextUrl.pathname === "/" ? "" : `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|login|invite|favicon.ico|icon.svg|.*\\..*).*)"],
};

import { NextResponse, type NextRequest } from "next/server";

import { isLocale, LOCALE_COOKIE, localeOf, negotiateLocale } from "@/lib/i18n/config";

const SESSION_COOKIE = "mv_session";
const PUBLIC_PATHS = ["/login", "/register"];

/**
 * 1. Language: every page lives under /en or /sw. Un-prefixed URLs (old links, bookmarks,
 *    typed addresses) are redirected using the saved preference, then the browser's
 *    languages.
 * 2. Optimistic route guard: redirects to the sign-in page when no session cookie is
 *    present. This is a UX convenience only; every API request is authorised by the backend.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const locale = localeOf(pathname);
  if (!locale) {
    const saved = request.cookies.get(LOCALE_COOKIE)?.value;
    const target = isLocale(saved) ? saved : negotiateLocale(request.headers.get("accept-language"));
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? `/${target}` : `/${target}${pathname}`;
    return NextResponse.redirect(url);
  }

  const rest = pathname.slice(locale.length + 1) || "/";
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.some((p) => rest.startsWith(p));

  if (!hasSession && !isPublic) {
    const url = new URL(`/${locale}/login`, request.url);
    if (rest !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  // The sign-in page stays reachable with a cookie: it may belong to an expired session.
  if (hasSession && rest === "/") {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/|_next/|assets/|favicon.ico|.*\\.(?:png|svg|jpg|webp|glb|ico|txt|json)$).*)"],
};

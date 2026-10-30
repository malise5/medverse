import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "mv_session";
const PUBLIC_PATHS = ["/login", "/register"];

/**
 * Optimistic route guard: redirects to /login when no session cookie is present.
 * This is a UX convenience only; every API request is authorised by the backend.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!hasSession && !isPublic) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  // /login stays reachable with a cookie: the cookie may belong to an expired session.
  if (hasSession && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/|_next/|assets/|favicon.ico|.*\\.(?:png|svg|jpg|glb|ico)$).*)"],
};

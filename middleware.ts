import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getCurrentRoute } from "@/lib/navigation";
import { decodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";

const pageRoutes = new Set(["/", "/instructions", "/post-session", "/done"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const doneSessionId = request.nextUrl.searchParams.get("sessionId");

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const cookiePayload = decodeSessionCookie(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!cookiePayload) {
    if (pathname === "/done" && doneSessionId) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  const currentRoute = getCurrentRoute(cookiePayload.completedSteps);
  const isTaskRoute = /^\/task\/[1-3]$/.test(pathname);
  const isKnownPage = pageRoutes.has(pathname) || isTaskRoute;

  if (!isKnownPage) {
    return NextResponse.next();
  }

  if (pathname !== currentRoute) {
    return NextResponse.redirect(new URL(currentRoute, request.url));
  }

  if (pathname === "/done") {
    const response = NextResponse.next();
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

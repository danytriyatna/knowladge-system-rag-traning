import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  getAuthSecret,
  getSessionCookieName,
  isSecureCookie,
} from "@/auth.config";

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const secret = getAuthSecret();
  const cookieName = getSessionCookieName();
  const token = secret
    ? await getToken({
        req: request,
        secret,
        secureCookie: isSecureCookie(),
        cookieName,
        salt: cookieName,
      }).catch(() => null)
    : null;

  const isAuthenticated = Boolean(token && (token.id || token.sub));

  if (pathname === "/" || pathname.startsWith("/documents")) {
    if (!isAuthenticated) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
  }

  if (
    pathname === "/login" &&
    isAuthenticated &&
    !searchParams.has("expired")
  ) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/documents/:path*", "/login"],
};

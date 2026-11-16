import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/lib/db";

export function getAuthSecret(): string | undefined {
  const secret = process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  return secret && secret.trim().length > 0 ? secret.trim() : undefined;
}

export function isSecureCookie(): boolean {
  if (process.env.AUTH_USE_SECURE_COOKIES === "true") return true;
  if (process.env.AUTH_USE_SECURE_COOKIES === "false") return false;
  return process.env.AUTH_URL?.startsWith("https://") ?? false;
}

export function getSessionCookieName(): string {
  return isSecureCookie()
    ? "__Secure-jp-insight.session-token"
    : "jp-insight.session-token";
}

function normalizeUserRole(role: unknown): UserRole {
  return role === "admin" ? "admin" : "unit_user";
}

export function createBaseAuthConfig(): NextAuthConfig {
  const secure = isSecureCookie();
  const sessionCookieName = getSessionCookieName();

  return {
    secret: getAuthSecret(),
    trustHost: true,
    useSecureCookies: secure,
    session: {
      strategy: "jwt",
      maxAge: 60 * 60 * 24 * 7, // 7 hari
    },
    // Nama cookie dibuat spesifik per aplikasi agar sesi JP-Insight (:3001)
    // tidak bertabrakan dengan sesi MQC (:3000) di host/IP yang sama.
    cookies: {
      sessionToken: {
        name: sessionCookieName,
        options: {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure,
        },
      },
      callbackUrl: {
        name: secure
          ? "__Secure-jp-insight.callback-url"
          : "jp-insight.callback-url",
        options: {
          sameSite: "lax",
          path: "/",
          secure,
        },
      },
      csrfToken: {
        name: secure
          ? "__Host-jp-insight.csrf-token"
          : "jp-insight.csrf-token",
        options: {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure,
        },
      },
    },
    pages: {
      signIn: "/login",
    },
    providers: [],
    callbacks: {
      jwt({ token, user }) {
        if (user) {
          token.id = user.id;
          token.fullName = user.fullName ?? user.name ?? "";
          token.role = normalizeUserRole(user.role);
          token.unit = user.unit ?? null;
          token.name = user.name ?? user.fullName ?? undefined;
          token.email = user.email;
        }
        return token;
      },
      session({ session, token }) {
        if (session.user) {
          session.user.id = (token.id as string) ?? token.sub ?? "";
          session.user.role = normalizeUserRole(token.role);
          session.user.fullName =
            typeof token.fullName === "string"
              ? token.fullName
              : typeof token.name === "string"
                ? token.name
                : "";
          session.user.unit = typeof token.unit === "string" ? token.unit : null;
          if (typeof token.name === "string") {
            session.user.name = token.name;
          }
          if (typeof token.email === "string") {
            session.user.email = token.email;
          }
        }
        return session;
      },
    },
  };
}

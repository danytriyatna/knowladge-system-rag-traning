import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { sql, type UserRecord } from "@/lib/db";
import {
  createUser,
  getUserByEmail,
  verifyPassword,
} from "@/lib/auth";
import {
  createBaseAuthConfig,
  getAuthSecret,
  getSessionCookieName,
  isSecureCookie,
} from "@/auth.config";
import { authorizeUserCredentials } from "@/auth";
import { proxy } from "@/proxy";

describe("JP-Insight NextAuth v5 Authentication & Proxy Suite", () => {
  let testUser: UserRecord;
  const testEmail = `nextauth-test-${Date.now()}@puskim.test`;
  const testPassword = "TestPassword#2026";
  const prevAuthSecret = process.env.AUTH_SECRET;
  const prevSessionSecret = process.env.SESSION_SECRET;
  const prevSecureFlag = process.env.AUTH_USE_SECURE_COOKIES;
  const prevAuthUrl = process.env.AUTH_URL;

  beforeAll(async () => {
    if (!process.env.AUTH_SECRET && !process.env.SESSION_SECRET) {
      process.env.SESSION_SECRET =
        "test_jp_insight_secret_at_least_32_characters_long_2026";
    }

    testUser = await createUser({
      email: testEmail,
      password: testPassword,
      fullName: "Penguji NextAuth",
      role: "unit_user",
      unit: "Balai Riset Permukiman",
    });
  });

  afterAll(async () => {
    if (testUser?.id) {
      await sql`DELETE FROM users WHERE id = ${testUser.id}`;
    }

    if (prevAuthSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = prevAuthSecret;

    if (prevSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSessionSecret;

    if (prevSecureFlag === undefined) delete process.env.AUTH_USE_SECURE_COOKIES;
    else process.env.AUTH_USE_SECURE_COOKIES = prevSecureFlag;

    if (prevAuthUrl === undefined) delete process.env.AUTH_URL;
    else process.env.AUTH_URL = prevAuthUrl;

    await sql.end({ timeout: 2 });
  });

  it("uses isolated JP-Insight cookie names and respects HTTP vs HTTPS config", () => {
    delete process.env.AUTH_USE_SECURE_COOKIES;
    process.env.AUTH_URL = "http://localhost:3001";
    expect(isSecureCookie()).toBe(false);
    expect(getSessionCookieName()).toBe("jp-insight.session-token");

    process.env.AUTH_URL = "https://jp-insight.pu.go.id";
    expect(isSecureCookie()).toBe(true);
    expect(getSessionCookieName()).toBe("__Secure-jp-insight.session-token");

    process.env.AUTH_USE_SECURE_COOKIES = "false";
    expect(isSecureCookie()).toBe(false);
    expect(getSessionCookieName()).toBe("jp-insight.session-token");
  });

  it("populates JWT and session callbacks with role, fullName, and unit", async () => {
    const config = createBaseAuthConfig();
    const jwtCallback = config.callbacks?.jwt;
    const sessionCallback = config.callbacks?.session;
    expect(jwtCallback).toBeDefined();
    expect(sessionCallback).toBeDefined();

    const adapterUser = {
      id: testUser.id,
      email: testUser.email,
      emailVerified: null,
      name: testUser.full_name,
      fullName: testUser.full_name,
      role: testUser.role,
      unit: testUser.unit,
    };

    const token = await jwtCallback!({
      token: { sub: testUser.id },
      user: adapterUser,
      account: null,
      trigger: "signIn",
    });

    if (!token) {
      throw new Error("JWT callback tidak mengembalikan token");
    }
    expect(token.id).toBe(testUser.id);
    expect(token.role).toBe("unit_user");
    expect(token.fullName).toBe("Penguji NextAuth");
    expect(token.unit).toBe("Balai Riset Permukiman");

    const session = await sessionCallback!({
      session: {
        expires: new Date(Date.now() + 3600_000).toISOString() as unknown as Date & string,
        sessionToken: "dummy-token",
        userId: testUser.id,
        user: {
          ...adapterUser,
          email: "",
          name: "",
          fullName: "",
          role: "unit_user",
          unit: null,
        },
      },
      token,
      user: adapterUser,
      newSession: undefined,
      trigger: "update",
    });

    if (!session.user) {
      throw new Error("Session callback tidak mengembalikan session.user");
    }
    expect(session.user.id).toBe(testUser.id);
    expect(session.user.email).toBe(testUser.email);
    expect(session.user.fullName).toBe("Penguji NextAuth");
    expect(session.user.role).toBe("unit_user");
    expect(session.user.unit).toBe("Balai Riset Permukiman");
  });

  it("authorizeUserCredentials authenticates PostgreSQL user with scrypt and logs audit", async () => {
    const stored = await getUserByEmail(testEmail);
    expect(stored).toBeDefined();
    expect(verifyPassword(testPassword, stored!.password_hash)).toBe(true);

    const authorized = await authorizeUserCredentials({
      email: `  ${testEmail.toUpperCase()}  `,
      password: testPassword,
    });
    expect(authorized).toEqual({
      id: testUser.id,
      email: testUser.email,
      name: "Penguji NextAuth",
      fullName: "Penguji NextAuth",
      role: "unit_user",
      unit: "Balai Riset Permukiman",
    });

    const auditRows = await sql<{ action: string }[]>`
      SELECT action FROM audit_log WHERE user_id = ${testUser.id} ORDER BY created_at DESC LIMIT 1
    `;
    expect(auditRows[0]?.action).toBe("login");
  });

  it("authorizeUserCredentials rejects wrong password, unknown user, and blank fields", async () => {
    expect(
      await authorizeUserCredentials({ email: testEmail, password: "wrong-password" })
    ).toBeNull();
    expect(
      await authorizeUserCredentials({ email: "nobody@puskim.test", password: testPassword })
    ).toBeNull();
    expect(
      await authorizeUserCredentials({ email: "", password: testPassword })
    ).toBeNull();
    expect(await authorizeUserCredentials(null)).toBeNull();
  });

  it("proxy protects /, /documents/*, redirects authenticated /login, and prevents expired loop", async () => {
    process.env.AUTH_USE_SECURE_COOKIES = "false";
    const secret = getAuthSecret()!;
    const cookieName = getSessionCookieName();
    expect(secret).toBeTruthy();

    const anonRoot = await proxy(new NextRequest("http://localhost:3001/"));
    expect(anonRoot.status).toBe(307);
    expect(new URL(anonRoot.headers.get("location")!).pathname).toBe("/login");

    const anonDoc = await proxy(new NextRequest("http://localhost:3001/documents/doc-123"));
    expect(anonDoc.status).toBe(307);
    expect(new URL(anonDoc.headers.get("location")!).pathname).toBe("/login");

    const anonLogin = await proxy(new NextRequest("http://localhost:3001/login"));
    expect(anonLogin.status).toBe(200);
    expect(anonLogin.headers.get("location")).toBeNull();

    const tampered = await proxy(
      new NextRequest("http://localhost:3001/", {
        headers: { Cookie: `${cookieName}=tampered.invalid.token` },
      })
    );
    expect(tampered.status).toBe(307);
    expect(new URL(tampered.headers.get("location")!).pathname).toBe("/login");

    const jwt = await encode({
      secret,
      salt: cookieName,
      token: {
        sub: testUser.id,
        id: testUser.id,
        email: testUser.email,
        name: testUser.full_name,
        fullName: testUser.full_name,
        role: testUser.role,
        unit: testUser.unit,
      },
    });
    const cookieHeader = `${cookieName}=${jwt}`;

    const authRoot = await proxy(
      new NextRequest("http://localhost:3001/", {
        headers: { Cookie: cookieHeader },
      })
    );
    expect(authRoot.status).toBe(200);
    expect(authRoot.headers.get("location")).toBeNull();

    const authDoc = await proxy(
      new NextRequest("http://localhost:3001/documents/doc-123", {
        headers: { Cookie: cookieHeader },
      })
    );
    expect(authDoc.status).toBe(200);
    expect(authDoc.headers.get("location")).toBeNull();

    const authLogin = await proxy(
      new NextRequest("http://localhost:3001/login", {
        headers: { Cookie: cookieHeader },
      })
    );
    expect(authLogin.status).toBe(307);
    expect(new URL(authLogin.headers.get("location")!).pathname).toBe("/");

    const expiredLogin = await proxy(
      new NextRequest("http://localhost:3001/login?expired=1", {
        headers: { Cookie: cookieHeader },
      })
    );
    expect(expiredLogin.status).toBe(200);
    expect(expiredLogin.headers.get("location")).toBeNull();
  });
});

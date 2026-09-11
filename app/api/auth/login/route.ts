import { NextResponse } from "next/server";
import {
  getUserByEmail,
  verifyPassword,
  createSessionToken,
  ensureBootstrapAdmin,
  logAudit,
  SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE,
} from "@/lib/auth";

export async function POST(request: Request) {
  await ensureBootstrapAdmin();

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email dan kata sandi wajib diisi" }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Email atau kata sandi salah" }, { status: 401 });
  }

  await logAudit(user.id, "login");

  const token = createSessionToken(user.id, user.role);
  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      unit: user.unit,
    },
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
  return response;
}

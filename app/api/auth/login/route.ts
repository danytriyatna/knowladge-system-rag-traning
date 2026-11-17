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

function buildLoginResponse(user: {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "unit_user";
  unit: string | null;
}) {
  const token = createSessionToken(user.id, user.role);
  const response = NextResponse.json({ user });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
  return response;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email dan kata sandi wajib diisi" }, { status: 400 });
  }

  if (process.env.DEV_MODE === "true") {
    if (email.toLowerCase() !== "dany@puskim.pu.go.id" || password !== "puskim2026") {
      return NextResponse.json({ error: "Email atau kata sandi salah" }, { status: 401 });
    }
    return buildLoginResponse({
      id: "dev-admin-dany",
      email: "dany@puskim.pu.go.id",
      fullName: "Dany Triyatna",
      role: "admin",
      unit: "Direktorat Bina Teknik Bangunan Gedung dan Penyehatan Lingkungan",
    });
  }

  await ensureBootstrapAdmin();

  const user = await getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Email atau kata sandi salah" }, { status: 401 });
  }

  await logAudit(user.id, "login");

  return buildLoginResponse({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    unit: user.unit,
  });
}

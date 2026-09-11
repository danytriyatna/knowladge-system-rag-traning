import { NextResponse } from "next/server";
import { db, type UserRole } from "@/lib/db";
import { requireAdmin, createUser, getUserByEmail, logAudit, AuthError } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const users = db
    .prepare("SELECT id, email, full_name, role, unit, created_at FROM users ORDER BY created_at ASC")
    .all();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const role: UserRole = body?.role === "admin" ? "admin" : "unit_user";
  const unit = typeof body?.unit === "string" ? body.unit.trim() : undefined;

  if (!email || !password || !fullName) {
    return NextResponse.json(
      { error: "Email, kata sandi, dan nama lengkap wajib diisi" },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Kata sandi minimal 8 karakter" },
      { status: 400 }
    );
  }
  if (getUserByEmail(email)) {
    return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
  }

  const user = createUser({ email, password, fullName, role, unit });
  logAudit(admin.id, "create_user", user.id, `${email} (${role})`);

  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        unit: user.unit,
      },
    },
    { status: 201 }
  );
}

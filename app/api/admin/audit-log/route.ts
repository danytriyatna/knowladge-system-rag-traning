import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, AuthError } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const rows = db
    .prepare(
      `SELECT a.id, a.action, a.target_id, a.detail, a.created_at,
              u.email as user_email, u.full_name as user_full_name
       FROM audit_log a
       JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC
       LIMIT 200`
    )
    .all();

  return NextResponse.json({ logs: rows });
}

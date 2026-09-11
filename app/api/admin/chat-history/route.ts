import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
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

  const rows = await sql`
    SELECT h.id, h.question, h.answer, h.created_at, h.mode, h.evidence_strength,
           u.email as user_email, u.full_name as user_full_name
    FROM chat_history h
    LEFT JOIN users u ON u.id = h.user_id
    ORDER BY h.created_at DESC
    LIMIT 200
  `;

  return NextResponse.json({ history: rows });
}

import { NextResponse } from "next/server";
import { sql, type ChatHistoryRecord } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const rows = await sql<
    Pick<ChatHistoryRecord, "id" | "question" | "created_at" | "mode" | "evidence_strength">[]
  >`
    SELECT id, question, created_at, mode, evidence_strength FROM chat_history WHERE user_id = ${user.id} ORDER BY created_at DESC
  `;

  return NextResponse.json({ history: rows });
}

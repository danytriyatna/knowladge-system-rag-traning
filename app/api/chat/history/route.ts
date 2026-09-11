import { NextResponse } from "next/server";
import { db, type ChatHistoryRecord } from "@/lib/db";
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

  const rows = db
    .prepare(
      "SELECT id, question, created_at, mode, evidence_strength FROM chat_history WHERE user_id = ? ORDER BY created_at DESC"
    )
    .all(user.id) as Pick<
    ChatHistoryRecord,
    "id" | "question" | "created_at" | "mode" | "evidence_strength"
  >[];

  return NextResponse.json({ history: rows });
}

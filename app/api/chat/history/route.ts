import { NextResponse } from "next/server";
import { db, type ChatHistoryRecord } from "@/lib/db";

export async function GET() {
  const rows = db
    .prepare(
      "SELECT id, question, created_at FROM chat_history ORDER BY created_at DESC"
    )
    .all() as Pick<ChatHistoryRecord, "id" | "question" | "created_at">[];

  return NextResponse.json({ history: rows });
}

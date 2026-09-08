import { NextResponse } from "next/server";
import { db, type ChatHistoryRecord } from "@/lib/db";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/chat/history/[id]">
) {
  const { id } = await ctx.params;
  const row = db
    .prepare("SELECT * FROM chat_history WHERE id = ?")
    .get(id) as ChatHistoryRecord | undefined;

  if (!row) {
    return NextResponse.json({ error: "Riwayat chat tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({
    history: {
      id: row.id,
      question: row.question,
      answer: row.answer,
      sources: JSON.parse(row.sources),
      created_at: row.created_at,
    },
  });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/chat/history/[id]">
) {
  const { id } = await ctx.params;
  db.prepare("DELETE FROM chat_history WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}

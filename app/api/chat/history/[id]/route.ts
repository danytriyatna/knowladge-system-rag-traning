import { NextResponse } from "next/server";
import { db, type ChatHistoryRecord } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/chat/history/[id]">
) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await ctx.params;
  const row = db
    .prepare("SELECT * FROM chat_history WHERE id = ? AND user_id = ?")
    .get(id, user.id) as ChatHistoryRecord | undefined;

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
      mode: row.mode,
      evidenceStrength: row.evidence_strength,
      points: row.points ? JSON.parse(row.points) : null,
    },
  });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/chat/history/[id]">
) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await ctx.params;
  db.prepare("DELETE FROM chat_history WHERE id = ? AND user_id = ?").run(id, user.id);
  return NextResponse.json({ ok: true });
}

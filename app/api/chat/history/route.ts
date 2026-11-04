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

  if (process.env.DEV_MODE === "true") {
    return NextResponse.json({
      history: [
        {
          id: "hist-demo-1",
          question: "Bagaimana ketahanan struktur RISHA terhadap beban gempa?",
          created_at: new Date(Date.now() - 3600000).toISOString(),
          mode: "chat",
          evidence_strength: "kuat",
        },
        {
          id: "hist-demo-2",
          question: "Kajian standar SNI material bata geopolimer untuk permukiman ramah lingkungan",
          created_at: new Date(Date.now() - 86400000).toISOString(),
          mode: "kajian",
          evidence_strength: "kuat",
        },
      ],
    });
  }

  const rows = await sql<
    Pick<ChatHistoryRecord, "id" | "question" | "created_at" | "mode" | "evidence_strength">[]
  >`
    SELECT id, question, created_at, mode, evidence_strength FROM chat_history WHERE user_id = ${user.id} ORDER BY created_at DESC
  `;

  return NextResponse.json({ history: rows });
}

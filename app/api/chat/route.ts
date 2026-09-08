import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { embedTexts } from "@/lib/embedding";
import { searchSimilarChunks, countEmbeddings } from "@/lib/rag";
import { answerFromContext } from "@/lib/chat";

export const maxDuration = 60;

const TOP_K = 5;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";

  if (!question) {
    return NextResponse.json({ error: "Pertanyaan tidak boleh kosong" }, { status: 400 });
  }

  if (countEmbeddings() === 0) {
    return NextResponse.json(
      {
        error:
          "Belum ada dokumen yang di-embed. Upload PDF, buat chunk, lalu buat embedding terlebih dahulu.",
      },
      { status: 422 }
    );
  }

  let queryVector: number[];
  try {
    [queryVector] = await embedTexts([question]);
  } catch {
    return NextResponse.json(
      { error: "Gagal memproses pertanyaan (embedding lokal gagal)" },
      { status: 500 }
    );
  }

  const chunks = searchSimilarChunks(queryVector, TOP_K);

  let answer: string;
  let usedSourceNumbers: number[];
  try {
    const result = await answerFromContext(question, chunks);
    answer = result.answer;
    usedSourceNumbers = result.usedSourceNumbers;
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("GEMINI_API_KEY")
        ? "GEMINI_API_KEY belum diset di server, tambahkan di .env.local"
        : "Gagal mendapatkan jawaban dari Gemini";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Hanya tampilkan sumber yang benar-benar dipakai Gemini untuk menjawab —
  // pencarian kemiripan bisa saja mengembalikan chunk yang mirip skornya
  // tapi topiknya tidak relevan.
  const usedNumbers = new Set(usedSourceNumbers);
  const sources = chunks
    .filter((_, i) => usedNumbers.has(i + 1))
    .map((c) => ({
      document_id: c.document_id,
      filename: c.filename,
      chunk_index: c.chunk_index,
      similarity: c.similarity,
    }));

  const id = randomUUID();
  const created_at = new Date().toISOString();
  db.prepare(
    `INSERT INTO chat_history (id, question, answer, sources, created_at)
     VALUES (@id, @question, @answer, @sources, @created_at)`
  ).run({ id, question, answer, sources: JSON.stringify(sources), created_at });

  return NextResponse.json({ id, answer, sources, created_at });
}

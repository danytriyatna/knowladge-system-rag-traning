import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { embedTexts } from "@/lib/embedding";
import { searchSimilarChunks, countEmbeddings, type RetrievedChunk } from "@/lib/rag";
import { answerFromContext } from "@/lib/chat";
import { NO_SOURCE_ANSWER, validSourceNumbers } from "@/lib/citation";

export const maxDuration = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const question = typeof body?.question === "string" ? body.question.trim() : "";

    if (!question) {
      return NextResponse.json(
        { error: "Pertanyaan tidak boleh kosong" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    if ((await countEmbeddings()) === 0) {
      return NextResponse.json(
        {
          error: "Korpus naskah belum diindeks. Hubungi administrator sistem.",
        },
        { status: 422, headers: CORS_HEADERS },
      );
    }

    let queryVector: number[];
    try {
      [queryVector] = await embedTexts([question]);
    } catch {
      return NextResponse.json(
        { error: "Gagal memproses pertanyaan (embedding lokal tidak merespon)" },
        { status: 500, headers: CORS_HEADERS },
      );
    }

    // Top-K pencarian hibrida untuk widget
    const chunks = await searchSimilarChunks(queryVector, question, 6, 4, undefined, 4);

    if (chunks.length === 0) {
      return NextResponse.json(
        {
          answer: NO_SOURCE_ANSWER,
          sources: [],
          grounded: false,
        },
        { status: 200, headers: CORS_HEADERS },
      );
    }

    let rawAnswer: string;
    let usedSourceNumbers: number[];
    try {
      const result = await answerFromContext(question, chunks);
      rawAnswer = result.answer;
      usedSourceNumbers = result.usedSourceNumbers;
    } catch (err) {
      const message =
        err instanceof Error && err.message.includes("GEMINI_API_KEY")
          ? "Layanan AI sedang dalam konfigurasi kunci API."
          : "Gagal menyusun jawaban saat ini.";
      return NextResponse.json({ error: message }, { status: 502, headers: CORS_HEADERS });
    }

    const usedNumbers = new Set(validSourceNumbers(usedSourceNumbers, chunks.length));
    const sources = chunks
      .filter((_, i) => usedNumbers.has(i + 1))
      .map((c: RetrievedChunk) => ({
        document_id: c.document_id,
        filename: c.filename,
        chunk_index: c.chunk_index,
        similarity: c.similarity,
        snippet: c.content.slice(0, 200) + (c.content.length > 200 ? "..." : ""),
      }));

    const finalAnswer = sources.length === 0 ? NO_SOURCE_ANSWER : rawAnswer;
    const id = randomUUID();
    const created_at = new Date().toISOString();

    // Simpan ke riwayat chat dengan penanda widget publik
    try {
      await sql`
        INSERT INTO chat_history (id, question, answer, sources, created_at, mode, evidence_strength, points, user_id)
        VALUES (${id}, ${question}, ${finalAnswer}, ${JSON.stringify(sources)}, ${created_at}, 'chat', null, null, 'public_widget')
      `;
    } catch {
      // Abaikan jika pencatatan riwayat gagal agar widget tetap merespon
    }

    return NextResponse.json(
      {
        id,
        answer: finalAnswer,
        sources,
        grounded: sources.length > 0,
        created_at,
      },
      { status: 200, headers: CORS_HEADERS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan internal";
    return NextResponse.json({ error: message }, { status: 500, headers: CORS_HEADERS });
  }
}

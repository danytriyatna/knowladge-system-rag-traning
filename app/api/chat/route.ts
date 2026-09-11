import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { sql, type QueryMode, type EvidenceStrength } from "@/lib/db";
import { requireUser, logAudit, AuthError } from "@/lib/auth";
import { embedTexts } from "@/lib/embedding";
import {
  searchSimilarChunks,
  countEmbeddings,
  type RetrievedChunk,
  type SearchFilters,
} from "@/lib/rag";
import { answerFromContext, synthesizeKajian } from "@/lib/chat";
import { evidenceStrengthFor, combineWeakestLink } from "@/lib/evidence";
import { NO_SOURCE_ANSWER, validSourceNumbers } from "@/lib/citation";

export const maxDuration = 60;

// Hybrid: cosine similarity + FTS5 kata kunci, digabung & di-dedup di
// lib/rag.ts. Jumlah akhir bisa lebih kecil dari totalnya setelah dedup.
// (semanticK, keywordK, regulationK) — jalur ketiga khusus pertanyaan
// normatif, hanya aktif kalau pertanyaannya memang mencari dasar aturan.
// regulationK perlu cukup longgar karena slotnya terbagi ke beberapa naskah
// kandidat, dan bagian yang menyebut dasar hukumnya sering tersebar (pendahuluan,
// metode, pembahasan) alih-alih menumpuk di satu tempat.
const TOP_K_CHAT: [number, number, number] = [10, 6, 10];
const TOP_K_KAJIAN: [number, number, number] = [18, 10, 12];

interface SourceCitation {
  document_id: string;
  filename: string;
  chunk_index: number;
  similarity: number;
}

function toCitation(chunk: RetrievedChunk): SourceCitation {
  return {
    document_id: chunk.document_id,
    filename: chunk.filename,
    chunk_index: chunk.chunk_index,
    similarity: chunk.similarity,
  };
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const mode: QueryMode = body?.mode === "kajian" ? "kajian" : "chat";

  const filters: SearchFilters = {};
  if (typeof body?.filters?.year === "number") filters.year = body.filters.year;
  if (Array.isArray(body?.filters?.topics)) {
    const topics = body.filters.topics.filter((t: unknown): t is string => typeof t === "string");
    if (topics.length > 0) filters.topics = topics;
  }

  if (!question) {
    return NextResponse.json({ error: "Pertanyaan tidak boleh kosong" }, { status: 400 });
  }

  if ((await countEmbeddings()) === 0) {
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

  const [semanticK, keywordK, regulationK] =
    mode === "kajian" ? TOP_K_KAJIAN : TOP_K_CHAT;
  const chunks = await searchSimilarChunks(
    queryVector,
    question,
    semanticK,
    keywordK,
    filters,
    regulationK
  );

  if (chunks.length === 0 && (filters.year || filters.topics)) {
    return NextResponse.json(
      {
        error:
          "Tidak ada naskah yang cocok dengan filter tahun/tema yang dipilih. Coba longgarkan filternya.",
      },
      { status: 422 }
    );
  }
  const id = randomUUID();
  const created_at = new Date().toISOString();

  if (mode === "kajian") {
    let kajian;
    try {
      kajian = await synthesizeKajian(question, chunks);
    } catch (err) {
      const message =
        err instanceof Error && err.message.includes("GEMINI_API_KEY")
          ? "GEMINI_API_KEY belum diset di server, tambahkan di .env.local"
          : "Gagal menyusun kajian dari Gemini";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    // Buang poin yang tidak punya sitasi valid sama sekali — indikasi klaim
    // tidak benar-benar berdasar konteks.
    const validPoints = kajian.points
      .map((p) => ({
        ...p,
        sourceNumbers: validSourceNumbers(p.sourceNumbers, chunks.length),
      }))
      .filter((p) => p.sourceNumbers.length > 0);

    const pointsWithCitations = validPoints.map((p) => {
      const citedChunks = p.sourceNumbers
        .map((n) => chunks[n - 1])
        .filter((c): c is RetrievedChunk => Boolean(c));
      const distinctDocs = new Set(citedChunks.map((c) => c.document_id));
      return {
        claim: p.claim,
        sources: citedChunks.map(toCitation),
        needsVerification: distinctDocs.size <= 1,
        distinctDocCount: distinctDocs.size,
      };
    });

    // Kekuatan bukti keseluruhan mengikuti klaim yang PALING LEMAH (weakest
    // link) — kalau satu saja klaim cuma didukung 1 naskah, label keseluruhan
    // ikut turun ke "lemah", supaya tidak overclaim hanya karena total naskah
    // yang tersentuh di seluruh kajian kebetulan banyak.
    const evidenceStrength: EvidenceStrength | null = combineWeakestLink(
      pointsWithCitations.map((p) => evidenceStrengthFor(p.distinctDocCount))
    );

    // Sumber flat (union, dedup per chunk) untuk konsistensi dengan mode chat.
    const seenChunks = new Set<string>();
    const sources: SourceCitation[] = [];
    for (const p of pointsWithCitations) {
      for (const s of p.sources) {
        const key = `${s.document_id}:${s.chunk_index}`;
        if (!seenChunks.has(key)) {
          seenChunks.add(key);
          sources.push(s);
        }
      }
    }

    // Pagar yang sama seperti mode chat: kajian tanpa satu pun poin bersitasi
    // tidak boleh menampilkan ringkasan buatan model.
    const summary =
      pointsWithCitations.length > 0 ? kajian.summary : NO_SOURCE_ANSWER;

    await sql`
      INSERT INTO chat_history (id, question, answer, sources, created_at, mode, evidence_strength, points, user_id)
      VALUES (${id}, ${question}, ${summary}, ${JSON.stringify(sources)}, ${created_at}, ${mode}, ${evidenceStrength}, ${JSON.stringify(pointsWithCitations)}, ${user.id})
    `;
    await logAudit(user.id, "query_kajian", id, question.slice(0, 200));

    return NextResponse.json({
      id,
      mode,
      answer: summary,
      points: pointsWithCitations,
      evidenceStrength,
      sources,
      created_at,
      grounded: sources.length > 0,
    });
  }

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
  const usedNumbers = new Set(validSourceNumbers(usedSourceNumbers, chunks.length));
  const sources = chunks.filter((_, i) => usedNumbers.has(i + 1)).map(toCitation);

  // Pagar terakhir: jawaban tanpa satu pun sumber tidak boleh sampai ke
  // pengguna. Teks model dibuang dan diganti pesan baku — kalau model memang
  // sedang menolak menjawab, isinya toh setara; kalau model sedang berhalusinasi,
  // di sinilah halusinasi itu berhenti.
  if (sources.length === 0) {
    answer = NO_SOURCE_ANSWER;
  }

  await sql`
    INSERT INTO chat_history (id, question, answer, sources, created_at, mode, evidence_strength, points, user_id)
    VALUES (${id}, ${question}, ${answer}, ${JSON.stringify(sources)}, ${created_at}, ${mode}, NULL, NULL, ${user.id})
  `;
  await logAudit(user.id, "query_chat", id, question.slice(0, 200));

  return NextResponse.json({
    id,
    mode,
    answer,
    sources,
    created_at,
    grounded: sources.length > 0,
  });
}

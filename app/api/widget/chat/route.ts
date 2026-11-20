import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { embedTexts } from "@/lib/embedding";
import { searchSimilarChunks, countEmbeddings } from "@/lib/rag";
import { answerFromContext, logAndDescribeGeminiError } from "@/lib/chat";
import {
  NO_SOURCE_ANSWER,
  buildChatSourceCitation,
  dedupeCitationsByDocument,
  validSourceNumbers,
} from "@/lib/citation";
import { searchPublishedOjsCorpus } from "@/lib/publishedLocal";
import { resolveOjsArticleBaseUrl } from "@/lib/portalExtract";
import {
  MAX_WIDGET_BODY_BYTES,
  checkWidgetRateLimit,
  evaluateWidgetCors,
  validateWidgetQuestion,
} from "@/lib/widgetGuard";

export const maxDuration = 60;

function resolveJpInsightPublicOrigin(request: Request): string {
  const explicit =
    process.env.JP_INSIGHT_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  if (host) {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const proto = forwardedProto || (new URL(request.url).protocol.replace(":", "") || "http");
    return `${proto}://${host}`;
  }

  try {
    return new URL(request.url).origin;
  } catch {
    return "";
  }
}

export async function OPTIONS(request: Request) {
  const cors = evaluateWidgetCors(request);
  if (!cors.allowed) {
    return NextResponse.json(
      { error: "Origin tidak diizinkan mengakses layanan widget ini." },
      { status: 403, headers: cors.headers },
    );
  }
  return new NextResponse(null, {
    status: 204,
    headers: cors.headers,
  });
}

export async function POST(request: Request) {
  const cors = evaluateWidgetCors(request);
  if (!cors.allowed) {
    return NextResponse.json(
      { error: "Origin tidak diizinkan mengakses layanan widget ini." },
      { status: 403, headers: cors.headers },
    );
  }

  const rateLimit = checkWidgetRateLimit(request);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: rateLimit.message },
      {
        status: 429,
        headers: {
          ...cors.headers,
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_WIDGET_BODY_BYTES) {
    return NextResponse.json(
      { error: "Ukuran permintaan terlalu besar." },
      { status: 413, headers: cors.headers },
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const validated = validateWidgetQuestion(body?.question);
    if (!validated.ok) {
      return NextResponse.json(
        { error: validated.error },
        { status: validated.status, headers: cors.headers },
      );
    }
    const question = validated.question;

    const embeddingCount = await countEmbeddings().catch(() => 0);

    if (embeddingCount === 0) {
      if (process.env.DEV_MODE === "true") {
        const localResult = searchPublishedOjsCorpus(question, { limit: 4, mode: "chat" });
        const id = randomUUID();
        const created_at = new Date().toISOString();
        return NextResponse.json(
          {
            id,
            answer: localResult.answer,
            sources: localResult.sources,
            grounded: localResult.grounded,
            created_at,
          },
          { status: 200, headers: cors.headers },
        );
      }
      return NextResponse.json(
        {
          error: "Korpus naskah belum diindeks. Hubungi administrator sistem.",
        },
        { status: 422, headers: cors.headers },
      );
    }

    let queryVector: number[];
    try {
      [queryVector] = await embedTexts([question]);
    } catch {
      return NextResponse.json(
        { error: "Gagal memproses pertanyaan (embedding lokal tidak merespon)" },
        { status: 500, headers: cors.headers },
      );
    }

    // Top-K pencarian hibrida dari sumber publik resmi: artikel terbit OJS, halaman portal OJS, & profil JP-Insight
    // (dokumen manual_upload internal tetap tidak dibuka ke widget publik)
    const chunks = await searchSimilarChunks(
      queryVector,
      question,
      8,
      6,
      { sources: ["ojs_harvest", "ojs_portal", "jp_insight_info"] },
      4,
    );

    if (chunks.length === 0) {
      return NextResponse.json(
        {
          answer: NO_SOURCE_ANSWER,
          sources: [],
          grounded: false,
        },
        { status: 200, headers: cors.headers },
      );
    }

    let rawAnswer: string;
    let usedSourceNumbers: number[];
    try {
      const result = await answerFromContext(question, chunks);
      rawAnswer = result.answer;
      usedSourceNumbers = result.usedSourceNumbers;
    } catch (err) {
      const { message, status } = logAndDescribeGeminiError(
        "POST /api/widget/chat",
        err,
      );
      return NextResponse.json(
        { error: message },
        { status, headers: cors.headers },
      );
    }

    const ojsArticleBase = resolveOjsArticleBaseUrl();
    const jpInsightOrigin = resolveJpInsightPublicOrigin(request);
    const usedNumbers = new Set(validSourceNumbers(usedSourceNumbers, chunks.length));
    const sources = dedupeCitationsByDocument(
      chunks
        .filter((_, i) => usedNumbers.has(i + 1))
        .map((c) => buildChatSourceCitation(c, ojsArticleBase, jpInsightOrigin)),
    );

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
      { status: 200, headers: cors.headers },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan internal";
    return NextResponse.json({ error: message }, { status: 500, headers: cors.headers });
  }
}

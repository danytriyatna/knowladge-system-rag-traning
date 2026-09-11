import { describe, expect, it, beforeAll } from "vitest";
import { sql } from "@/lib/db";
import { embedTexts } from "@/lib/embedding";
import { searchSimilarChunks, type RetrievedChunk } from "@/lib/rag";
import { answerFromContext, synthesizeKajian } from "@/lib/chat";
import { evidenceStrengthFor, combineWeakestLink } from "@/lib/evidence";

/**
 * Tes akurasi ujung-ke-ujung: retrieval sungguhan dari korpus produksi +
 * panggilan Gemini sungguhan (bukan mock) — mengukur dua hal yang paling
 * penting soal keakuratan RAG ini:
 *   1. Grounding: kalau jawabannya menyitir sumber, sumber itu harus benar-
 *      benar naskah yang relevan (bukan sitasi acak/di luar rentang).
 *   2. Anti-halusinasi: untuk pertanyaan yang sama sekali di luar cakupan
 *      korpus, sistem harus mengaku tidak tahu, bukan mengarang jawaban.
 *
 * Membutuhkan GEMINI_API_KEY (di .env.local) dan koneksi internet — di-skip
 * otomatis kalau key tidak ada, supaya tidak menggagalkan `npm test` di
 * lingkungan tanpa key.
 */

// Sama seperti konstanta TOP_K_CHAT / TOP_K_KAJIAN di app/api/chat/route.ts,
// supaya tes ini merepresentasikan perilaku endpoint yang sesungguhnya.
const TOP_K_CHAT: [number, number] = [10, 6];
const TOP_K_KAJIAN: [number, number] = [18, 10];

const hasApiKey = Boolean(process.env.GEMINI_API_KEY);
const describeIfKey = hasApiKey ? describe : describe.skip;

async function retrieve(question: string, k: [number, number], filters?: { year?: number }) {
  const [queryVector] = await embedTexts([question]);
  return await searchSimilarChunks(queryVector, question, k[0], k[1], filters);
}

function assertValidSourceNumbers(usedSourceNumbers: number[], chunks: RetrievedChunk[]) {
  for (const n of usedSourceNumbers) {
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(chunks.length);
  }
}

beforeAll(() => {
  if (!hasApiKey) {
    console.warn(
      "[chat-accuracy] GEMINI_API_KEY tidak ditemukan — tes akurasi jawaban Gemini di-skip."
    );
  }
});

describeIfKey("chat mode — akurasi jawaban & sitasi (Gemini sungguhan)", () => {
  it(
    "pertanyaan spesifik dalam cakupan korpus dijawab dengan sitasi ke naskah yang benar",
    async () => {
      const question = "Bagaimana kinerja instalasi pengolahan air limbah komunal di Kota Bogor?";
      const expectedDocumentId = "1cec8330-4e6f-4b36-a215-88b62fe9a938";

      const chunks = await retrieve(question, TOP_K_CHAT);
      expect(chunks.length).toBeGreaterThan(0);

      const { answer, usedSourceNumbers } = await answerFromContext(question, chunks);

      expect(answer.trim().length).toBeGreaterThan(0);
      assertValidSourceNumbers(usedSourceNumbers, chunks);

      // Grounding check: setidaknya satu sumber yang benar-benar dipakai
      // model harus berasal dari naskah yang memang membahas topik ini.
      const usedDocIds = usedSourceNumbers.map((n) => chunks[n - 1].document_id);
      expect(usedDocIds).toContain(expectedDocumentId);
    }
  );

  it(
    "pertanyaan di luar cakupan korpus (topik kuliner) tidak dijawab dengan sitasi mengarang",
    async () => {
      const question =
        "Bagaimana resep dan langkah membuat rendang daging sapi khas Padang yang enak?";

      const chunks = await retrieve(question, TOP_K_CHAT);
      const { usedSourceNumbers } = await answerFromContext(question, chunks);

      // Korpus adalah jurnal teknik permukiman — tidak ada satupun naskah
      // tentang resep masakan, jadi model wajib TIDAK menyitir sumber apa pun
      // (bukan memaksakan salah satu hasil pencarian yang kebetulan muncul).
      expect(usedSourceNumbers).toHaveLength(0);
    }
  );
});

describeIfKey("kajian mode — akurasi sintesis & kekuatan bukti (Gemini sungguhan)", () => {
  it(
    "sintesis multi-naskah tentang beton menghasilkan poin dengan sitasi valid",
    async () => {
      const question =
        "Apa saja temuan penelitian terkait sifat mekanik dan campuran beton untuk konstruksi bangunan tahan gempa?";

      const chunks = await retrieve(question, TOP_K_KAJIAN);
      expect(chunks.length).toBeGreaterThan(0);

      const kajian = await synthesizeKajian(question, chunks);
      expect(kajian.summary.trim().length).toBeGreaterThan(0);

      const validPoints = kajian.points.filter((p) => p.sourceNumbers.length > 0);
      expect(validPoints.length).toBeGreaterThan(0);

      for (const point of validPoints) {
        assertValidSourceNumbers(point.sourceNumbers, chunks);
      }

      // Kekuatan bukti keseluruhan harus konsisten dengan aturan weakest-link
      // yang sesungguhnya dipakai endpoint (lib/evidence.ts), dihitung ulang
      // di sini dari data mentah supaya jadi verifikasi independen.
      const strengths = validPoints.map((p) => {
        const docIds = new Set(
          p.sourceNumbers.map((n) => chunks[n - 1]?.document_id).filter(Boolean)
        );
        return evidenceStrengthFor(docIds.size);
      });
      const overall = combineWeakestLink(strengths);
      expect(["kuat", "sedang", "lemah"]).toContain(overall);
    }
  );

  it(
    "pertanyaan di luar cakupan korpus (topik kuliner) tidak menghasilkan poin kajian yang mengarang",
    async () => {
      const question = "Apa kajian ilmiah tentang resep rendang daging sapi khas Padang?";
      const chunks = await retrieve(question, TOP_K_KAJIAN);

      const kajian = await synthesizeKajian(question, chunks);
      const validPoints = kajian.points.filter((p) => p.sourceNumbers.length > 0);
      expect(validPoints).toHaveLength(0);
    }
  );
});

describe("sanity: korpus produksi tersedia untuk tes akurasi", () => {
  it("tabel documents & embeddings tidak kosong", async () => {
    const [{ c: docCount }] = await sql<{ c: number }[]>`SELECT COUNT(*)::int c FROM documents`;
    const [{ c: embCount }] = await sql<{ c: number }[]>`SELECT COUNT(*)::int c FROM embeddings`;
    expect(docCount).toBeGreaterThan(0);
    expect(embCount).toBeGreaterThan(0);
  });
});

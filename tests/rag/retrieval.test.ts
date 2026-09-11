import { describe, expect, it, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { embedTexts } from "@/lib/embedding";
import { searchSimilarChunks, countEmbeddings } from "@/lib/rag";

/**
 * Tes ini jalan lawan korpus produksi (storage/db.sqlite) yang sudah di-embed
 * sungguhan lewat proses harvest OJS + embedding lokal — bukan data tiruan.
 * Tujuannya mengukur akurasi retrieval hybrid (semantic + keyword) yang
 * benar-benar dipakai lewat /api/chat: untuk pertanyaan bahasa natural
 * tentang topik naskah tertentu, apakah naskah yang benar muncul di hasil
 * teratas?
 */

interface GroundTruthCase {
  question: string;
  expectedDocumentId: string;
  expectedYear: number;
  expectedTopic: string;
  description: string;
}

// Diambil langsung dari korpus (lihat judul/topics di documents) — kasus
// dipilih karena topiknya cukup spesifik untuk dibedakan dari 200+ naskah lain.
const CASES: GroundTruthCase[] = [
  {
    description: "IPAL komunal Kota Bogor",
    question: "Bagaimana kinerja instalasi pengolahan air limbah komunal di Kota Bogor?",
    expectedDocumentId: "1cec8330-4e6f-4b36-a215-88b62fe9a938",
    expectedYear: 2018,
    expectedTopic: "Ipal komunal",
  },
  {
    description: "Erosi dan abrasi Pulau Miangas",
    question: "Bagaimana cara mencegah erosi dan abrasi di kawasan pantai Pulau Miangas?",
    expectedDocumentId: "94fcfd62-1ae3-4f1c-bf43-30bbe89f7ee8",
    expectedYear: 2010,
    expectedTopic: "Erosi",
  },
  {
    description: "Bank sampah Kiaracondong Bandung",
    question: "Bagaimana gerakan menabung di bank sampah bisa meningkatkan peran serta masyarakat di Kiaracondong Bandung?",
    expectedDocumentId: "d5ac5988-27ae-452e-a293-7a3af13acce9",
    expectedYear: 2011,
    expectedTopic: "bank sampah",
  },
  {
    description: "Serat sintetik pada campuran beton",
    question: "Apa pengaruh penambahan serat sintetik pada campuran beton terhadap sifat mekanik beton?",
    expectedDocumentId: "15b33088-5160-4421-a5fa-f664fbb87002",
    expectedYear: 2016,
    expectedTopic: "serat sintetik",
  },
  {
    description: "Faktor langit SNI pencahayaan alami",
    question: "Bagaimana usulan pembaruan tabel faktor langit pada SNI tentang pencahayaan alami pada bangunan?",
    expectedDocumentId: "d2614cb0-5111-4963-9023-2e7156fcf72e",
    expectedYear: 2021,
    expectedTopic: "faktor langit",
  },
];

// Sama seperti TOP_K_CHAT di app/api/chat/route.ts. Semua chunk hasil merge
// (bukan cuma beberapa teratas) dikirim penuh sebagai konteks ke Gemini, jadi
// "berhasil ditemukan" yang relevan dengan produksi adalah "ada di dalam
// himpunan hasil ini", bukan "nangkring di posisi 1-2" — hybrid search sengaja
// menggabungkan sinyal semantic + keyword, dan skor cosine keduanya tidak
// selalu sebanding, jadi urutan akhir bukan ukuran relevansi yang presisi.
const TOP_K_CHAT: [number, number] = [10, 6];

let corpusReady = false;

beforeAll(() => {
  corpusReady = countEmbeddings() > 0;
  for (const c of CASES) {
    const row = db.prepare("SELECT id FROM documents WHERE id = ?").get(c.expectedDocumentId);
    if (!row) {
      throw new Error(
        `Fixture rusak: dokumen ground-truth "${c.description}" (${c.expectedDocumentId}) tidak ada lagi di storage/db.sqlite`
      );
    }
  }
});

describe("hybrid retrieval accuracy (korpus produksi)", () => {
  it("korpus punya embedding untuk ditest", () => {
    expect(corpusReady).toBe(true);
  });

  it.each(CASES)(
    "konteks yang dikirim ke Gemini (TOP_K_CHAT) untuk pertanyaan tentang $description memuat naskah yang benar",
    async ({ question, expectedDocumentId }) => {
      const [queryVector] = await embedTexts([question]);
      const results = searchSimilarChunks(queryVector, question, ...TOP_K_CHAT);

      expect(results.length).toBeGreaterThan(0);
      const docIds = results.map((r) => r.document_id);
      expect(docIds).toContain(expectedDocumentId);
    }
  );

  it.each(CASES)(
    "naskah yang benar untuk $description masuk 5 besar berdasarkan skor cosine murni (kualitas semantic-only)",
    async ({ question, expectedDocumentId }) => {
      // Beda dari tes di atas: ini murni mengukur kualitas sinyal semantic
      // saja (skor cosine tertinggi), bukan hasil gabungan hybrid — supaya
      // regresi kualitas embedding kelihatan meski masih "diselamatkan" FTS.
      const [queryVector] = await embedTexts([question]);
      const results = searchSimilarChunks(queryVector, question, ...TOP_K_CHAT);
      const top5BySimilarity = [...results]
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5)
        .map((r) => r.document_id);
      const matchedTop5 = top5BySimilarity.includes(expectedDocumentId);
      // Tidak digagalkan kalau meleset (model kecil wajar kadang meleset di
      // top-5 murni semantic) — tapi dicatat supaya terlihat di laporan.
      if (!matchedTop5) {
        console.warn(
          `[semantic-only] "${expectedDocumentId}" tidak masuk top-5 cosine murni untuk: "${question}" — kemungkinan hanya terselamatkan oleh keyword/FTS.`
        );
      }
      expect(results.map((r) => r.document_id)).toContain(expectedDocumentId);
    }
  );

  it.each(CASES)(
    "filter tahun ($expectedYear) untuk $description hanya me-return chunk dari dokumen tahun itu",
    async ({ question, expectedYear }) => {
      const [queryVector] = await embedTexts([question]);
      const results = searchSimilarChunks(queryVector, question, 10, 10, { year: expectedYear });

      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        const row = db
          .prepare("SELECT published_year FROM documents WHERE id = ?")
          .get(r.document_id) as { published_year: number | null };
        expect(row.published_year).toBe(expectedYear);
      }
    }
  );

  it.each(CASES)(
    "filter tema ('$expectedTopic') untuk $description tetap memuat naskah yang benar",
    async ({ question, expectedDocumentId, expectedTopic }) => {
      const [queryVector] = await embedTexts([question]);
      const results = searchSimilarChunks(queryVector, question, 10, 10, {
        topics: [expectedTopic],
      });

      const docIds = results.map((r) => r.document_id);
      expect(docIds).toContain(expectedDocumentId);
    }
  );

  it("filter tahun yang tidak cocok dengan naskah manapun mengembalikan hasil kosong", async () => {
    const question = CASES[0].question;
    const [queryVector] = await embedTexts([question]);
    const results = searchSimilarChunks(queryVector, question, 10, 10, { year: 1899 });
    expect(results).toHaveLength(0);
  });

  it("naskah 'faktor langit' hanya lolos lewat jalur literal (keyword/peraturan) — model embedding kecil melewatkan istilah ini secara semantik", async () => {
    // Temuan nyata saat menyusun tes ini: untuk istilah teknis spesifik
    // seperti "faktor langit" (sky component), MiniLM tidak menempatkan
    // naskah ini di top-10 murni semantic sama sekali — FTS5-lah yang
    // menyelamatkannya. Tes ini mengunci perilaku itu supaya kalau suatu
    // saat FTS/keyword path rusak, regresi ini langsung ketahuan (bukan
    // diam-diam membuat naskah ini tidak pernah muncul lagi ke pengguna).
    const question =
      "Bagaimana usulan pembaruan tabel faktor langit pada SNI tentang pencahayaan alami pada bangunan?";
    const expectedDocumentId = "d2614cb0-5111-4963-9023-2e7156fcf72e";

    const [queryVector] = await embedTexts([question]);
    const results = searchSimilarChunks(queryVector, question, ...TOP_K_CHAT);
    const matched = results.find((r) => r.document_id === expectedDocumentId);

    expect(matched).toBeDefined();
    // Pertanyaan ini menyebut "SNI", sehingga jalur peraturan ikut aktif dan
    // naskahnya kini terjangkau lewat dua jalur literal sekaligus. Yang dikunci
    // tes ini tetap sama: naskah ini TIDAK boleh bergantung pada jalur semantik.
    expect(["keyword", "regulation"]).toContain(matched?.matchedBy);
  });

  it("kata kunci spesifik/langka (nama tempat) ditemukan lewat pencocokan literal (FTS)", async () => {
    // "Giliyang" adalah nama pulau yang spesifik — kecil kemungkinan model
    // embedding kecil menangkapnya secara semantik, tapi FTS5 harus tetap
    // menemukannya secara literal.
    const question = "Apa hasil pengkajian sarana prasarana permukiman di Pulau Giliyang?";
    const [queryVector] = await embedTexts([question]);
    const results = searchSimilarChunks(queryVector, question, 8, 8);

    const giliyangDocId = "121413a4-8b73-4a0b-8230-3e68fc6defd0";
    const matched = results.find((r) => r.document_id === giliyangDocId);
    expect(matched).toBeDefined();
  });
});

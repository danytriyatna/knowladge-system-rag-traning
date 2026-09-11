import { randomUUID } from "node:crypto";
import { GoogleGenAI, Type } from "@google/genai";
import { sql, type ClaimKind, type ClaimRecord } from "./db";

const MODEL = process.env.GEMINI_CHAT_MODEL ?? "gemini-3.1-flash-lite";

/**
 * Penanda kalimat yang BERPOTENSI memuat pernyataan celah riset.
 *
 * Ini hanya penyaring kandidat, bukan pemutus. Regex tidak bisa membedakan
 * "penelitian ini masih terbatas" (celah riset) dari "program ini masih
 * terbatas pada sarana MCK" (keterbatasan program) — pembedaan itu tugas LLM
 * di tahap berikutnya. Fungsinya di sini semata memangkas 8.589 chunk menjadi
 * puluhan, supaya biaya panen tetap masuk akal.
 */
const GAP_MARKERS =
  /(saran\s+(?:untuk\s+)?penelitian\s+(?:selanjutnya|lanjutan|berikutnya)|penelitian\s+(?:lebih\s+lanjut|selanjutnya)|studi\s+lanjutan|riset\s+lanjutan|keterbatasan\s+(?:penelitian|studi|kajian)|belum\s+(?:banyak|pernah)\s+(?:diteliti|dikaji|dilakukan)|masih\s+terbatas|perlu\s+(?:dikaji|diteliti|dilakukan\s+penelitian)|direkomendasikan\s+untuk\s+(?:dikaji|diteliti))/i;

export function isGapCandidate(text: string): boolean {
  return GAP_MARKERS.test(text);
}

export interface GapCandidate {
  chunk_id: string;
  document_id: string;
  chunk_index: number;
  content: string;
}

/** Chunk yang lolos penyaring kandidat, dibatasi satu dokumen bila diminta. */
export async function findGapCandidates(documentId?: string): Promise<GapCandidate[]> {
  const rows = documentId
    ? await sql<GapCandidate[]>`
        SELECT id as chunk_id, document_id, chunk_index, content FROM chunks
        WHERE document_id = ${documentId} ORDER BY chunk_index
      `
    : await sql<GapCandidate[]>`
        SELECT id as chunk_id, document_id, chunk_index, content FROM chunks
        ORDER BY document_id, chunk_index
      `;

  return rows.filter((r) => isGapCandidate(r.content));
}

export interface ExtractedGap {
  jenis: Extract<ClaimKind, "keterbatasan" | "saran_lanjutan">;
  teks: string;
  kutipan: string;
  topik: string;
}

function buildPrompt(content: string): string {
  return `Anda membaca satu potongan naskah ilmiah bidang ke-PU-an (permukiman, bangunan gedung, air minum, sanitasi). Tugas Anda HANYA satu: mengeluarkan pernyataan CELAH RISET yang benar-benar ditulis penulis di dalam potongan ini.

Yang dimaksud celah riset ada dua jenis:
- "keterbatasan" — penulis mengakui batas dari penelitiannya sendiri, atau menyatakan suatu hal belum banyak diteliti.
- "saran_lanjutan" — penulis menyarankan penelitian lanjutan yang perlu dilakukan.

ATURAN WAJIB:
1. Hanya keluarkan pernyataan yang BENAR-BENAR ada di teks. Dilarang menyimpulkan, menebak, atau menambah celah riset yang tidak ditulis penulis.
2. WAJIB membedakan celah RISET dari keterbatasan PROGRAM/KEGIATAN. Contoh yang HARUS DITOLAK: "program pembangunan ini masih terbatas pada sarana mandi, cuci, kakus" — itu keterbatasan program di lapangan, bukan celah penelitian. Begitu juga keterbatasan anggaran, keterbatasan lahan, atau keterbatasan kapasitas layanan.
3. Field "kutipan" WAJIB disalin PERSIS dari teks (satu kalimat utuh, apa adanya, tanpa diubah satu huruf pun). Ini dipakai untuk memverifikasi bahwa pernyataan tidak dikarang.
4. Field "teks" adalah pernyataan celah itu ditulis ulang menjadi satu kalimat mandiri yang bisa dibaca tanpa konteks sekitarnya.
5. Field "topik" diisi 2-5 kata inti bidang yang dibahas (mis. "adsorben logam berat", "rumah tahan gempa").
6. Kalau potongan ini tidak memuat celah riset sama sekali, kembalikan daftar KOSONG. Ini hasil yang wajar dan sering terjadi — jangan memaksakan menemukan sesuatu.

POTONGAN NASKAH:
${content}`;
}

/** Normalisasi ringan untuk mencocokkan kutipan dengan teks aslinya. */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Panen pernyataan celah riset dari satu potongan naskah.
 *
 * Hasil model diverifikasi terhadap teks asli: kutipan yang tidak benar-benar
 * ada di dalam potongan digugurkan. Tanpa pemeriksaan ini, "jangan mengarang"
 * hanya bergantung pada kepatuhan model.
 */
export async function extractGapsFromChunk(content: string): Promise<ExtractedGap[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY belum diset di environment");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildPrompt(content),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          gaps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                jenis: {
                  type: Type.STRING,
                  enum: ["keterbatasan", "saran_lanjutan"],
                  description: "Jenis pernyataan celah riset.",
                },
                teks: {
                  type: Type.STRING,
                  description: "Pernyataan celah ditulis ulang jadi satu kalimat mandiri.",
                },
                kutipan: {
                  type: Type.STRING,
                  description: "Kalimat asli dari naskah, disalin persis tanpa perubahan.",
                },
                topik: { type: Type.STRING, description: "2-5 kata inti bidang yang dibahas." },
              },
              required: ["jenis", "teks", "kutipan", "topik"],
            },
          },
        },
        required: ["gaps"],
      },
    },
  });

  const text = response.text;
  if (!text) return [];

  let parsed: { gaps?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.gaps)) return [];

  const haystack = normalize(content);

  return parsed.gaps
    .filter((g): g is Record<string, unknown> => typeof g === "object" && g !== null)
    .map((g) => ({
      jenis: g.jenis === "keterbatasan" ? ("keterbatasan" as const) : ("saran_lanjutan" as const),
      teks: typeof g.teks === "string" ? g.teks.trim() : "",
      kutipan: typeof g.kutipan === "string" ? g.kutipan.trim() : "",
      topik: typeof g.topik === "string" ? g.topik.trim() : "",
    }))
    .filter((g) => {
      if (!g.teks || !g.kutipan) return false;
      // Pagar anti-karang: kutipan harus benar-benar ada di potongan aslinya.
      return haystack.includes(normalize(g.kutipan));
    });
}

export interface HarvestOutcome {
  candidates: number;
  processed: number;
  claims: number;
  failed: number;
  /** Alasan kegagalan yang berbeda-beda — jangan sampai gagal secara senyap. */
  errors: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|RESOURCE_EXHAUSTED|rate limit|quota/i.test(msg);
}

/**
 * Panggil model dengan mundur bertahap saat kena pembatasan laju.
 *
 * Panen menembakkan ratusan permintaan berurutan, dan kuota per menit habis
 * jauh sebelum korpus selesai — tanpa jeda ini sebagian besar potongan gagal.
 */
async function extractWithRetry(content: string, attempts = 4): Promise<ExtractedGap[]> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await extractGapsFromChunk(content);
    } catch (err) {
      lastError = err;
      if (!isRateLimit(err) || i === attempts - 1) throw err;
      await sleep(2000 * 2 ** i); // 2s, 4s, 8s
    }
  }
  throw lastError;
}

/**
 * Panen celah riset untuk seluruh korpus (atau satu dokumen).
 *
 * Hanya chunk kandidat yang dikirim ke model, dan hasil lama untuk dokumen
 * yang sama dihapus lebih dulu supaya panen ulang tidak menggandakan isi.
 */
export async function harvestGaps(options?: {
  documentId?: string;
  limit?: number;
}): Promise<HarvestOutcome> {
  const candidates = await findGapCandidates(options?.documentId);
  const selected = options?.limit ? candidates.slice(0, options.limit) : candidates;

  const touchedDocuments = new Set(selected.map((c) => c.document_id));
  for (const documentId of touchedDocuments) {
    await sql`
      DELETE FROM claims WHERE document_id = ${documentId} AND jenis IN ('keterbatasan','saran_lanjutan')
    `;
  }

  let claims = 0;
  let processed = 0;
  let failed = 0;
  const errors = new Set<string>();

  for (const [index, candidate] of selected.entries()) {
    // Jeda antar panggilan agar tidak menabrak kuota per menit.
    if (index > 0) await sleep(1200);
    try {
      const gaps = await extractWithRetry(candidate.content);
      const now = new Date().toISOString();
      for (const gap of gaps) {
        await sql`
          INSERT INTO claims (id, document_id, chunk_id, jenis, teks, kutipan, topik, created_at)
          VALUES (${randomUUID()}, ${candidate.document_id}, ${candidate.chunk_id}, ${gap.jenis}, ${gap.teks}, ${gap.kutipan}, ${gap.topik}, ${now})
        `;
        claims++;
      }
      processed++;
    } catch (err) {
      // Satu potongan yang gagal tidak boleh menggagalkan seluruh panen —
      // tapi alasannya wajib dicatat, bukan ditelan diam-diam.
      failed++;
      errors.add(err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200));
    }
  }

  return {
    candidates: candidates.length,
    processed,
    claims,
    failed,
    errors: Array.from(errors).slice(0, 5),
  };
}

export interface GapClaim extends ClaimRecord {
  filename: string;
  title: string;
  published_year: number | null;
  chunk_index: number;
}

export interface GapFilters {
  jenis?: ClaimKind;
  search?: string;
  year?: number;
}

export async function listGapClaims(filters?: GapFilters): Promise<GapClaim[]> {
  const jenisFragment = filters?.jenis ? sql`AND c.jenis = ${filters.jenis}` : sql``;
  const yearFragment = filters?.year ? sql`AND d.published_year = ${filters.year}` : sql``;
  const searchFragment = filters?.search
    ? sql`AND (LOWER(c.teks) LIKE ${`%${filters.search.toLowerCase()}%`} OR LOWER(c.topik) LIKE ${`%${filters.search.toLowerCase()}%`} OR LOWER(d.title) LIKE ${`%${filters.search.toLowerCase()}%`})`
    : sql``;

  return sql<GapClaim[]>`
    SELECT c.*, d.filename, d.title, d.published_year, ch.chunk_index
    FROM claims c
    JOIN documents d ON d.id = c.document_id
    JOIN chunks ch ON ch.id = c.chunk_id
    WHERE c.jenis IN ('keterbatasan','saran_lanjutan') ${jenisFragment} ${yearFragment} ${searchFragment}
    ORDER BY d.published_year DESC, d.title ASC
  `;
}

export async function countGapClaims(): Promise<{ total: number; keterbatasan: number; saran: number; documents: number }> {
  const [row] = await sql<{ total: number; keterbatasan: number | null; saran: number | null; documents: number }[]>`
    SELECT COUNT(*)::int as total,
           SUM((jenis = 'keterbatasan')::int) as keterbatasan,
           SUM((jenis = 'saran_lanjutan')::int) as saran,
           COUNT(DISTINCT document_id)::int as documents
    FROM claims WHERE jenis IN ('keterbatasan','saran_lanjutan')
  `;

  return {
    total: row.total,
    keterbatasan: row.keterbatasan ?? 0,
    saran: row.saran ?? 0,
    documents: row.documents,
  };
}

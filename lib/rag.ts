import { db } from "./db";
import { bufferToVector, cosineSimilarity } from "./embedding";
import { isNormativeQuestion, expandQueryTerms } from "./query";

export interface RetrievedChunk {
  document_id: string;
  filename: string;
  chunk_index: number;
  content: string;
  similarity: number;
  matchedBy: "semantic" | "keyword" | "regulation";
}

export interface SearchFilters {
  year?: number;
  topics?: string[];
}

interface EmbeddingSearchRow {
  chunk_rowid: number;
  vector: Buffer;
  document_id: string;
  chunk_index: number;
  content: string;
  filename: string;
}

// Kata umum Bahasa Indonesia yang dibuang dari query FTS supaya pencarian
// kata kunci fokus ke istilah yang benar-benar bermakna, bukan kata tanya.
const STOPWORDS = new Set([
  "apa", "yang", "untuk", "dari", "dan", "atau", "ini", "itu", "adalah",
  "dengan", "pada", "ke", "ada", "bagaimana", "berapa", "siapa", "kapan",
  "mengapa", "kenapa", "tolong", "jelaskan", "sebutkan", "bisa", "akan",
  "juga", "saja", "para", "oleh", "dalam", "secara", "tentang", "sudah",
]);

function buildFtsQuery(text: string): string | null {
  const tokens = Array.from(text.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu))
    .map((m) => m[0])
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));

  if (tokens.length === 0) return null;
  // Escape tanda kutip ganda, lalu bungkus tiap token jadi literal FTS5.
  return tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(" OR ");
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** Bangun klausa WHERE + parameter untuk filter dokumen (tahun, tema). */
function buildDocumentFilter(filters: SearchFilters | undefined): {
  clause: string;
  params: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.year) {
    conditions.push("d.published_year = ?");
    params.push(filters.year);
  }
  if (filters?.topics && filters.topics.length > 0) {
    const topicConditions = filters.topics.map((topic) => {
      params.push(`%"${escapeLike(topic.toLowerCase())}"%`);
      return `LOWER(d.topics) LIKE ? ESCAPE '\\'`;
    });
    conditions.push(`(${topicConditions.join(" OR ")})`);
  }

  if (conditions.length === 0) return { clause: "", params: [] };
  return { clause: `WHERE ${conditions.join(" AND ")}`, params };
}

function fetchAllEmbeddingRows(filters?: SearchFilters): EmbeddingSearchRow[] {
  const { clause, params } = buildDocumentFilter(filters);
  return db
    .prepare(
      `SELECT c.rowid as chunk_rowid, e.vector, e.document_id, c.chunk_index, c.content, d.filename
       FROM embeddings e
       JOIN chunks c ON c.id = e.chunk_id
       JOIN documents d ON d.id = e.document_id
       ${clause}`
    )
    .all(...params) as EmbeddingSearchRow[];
}

/** Cari rowid chunk yang cocok secara literal lewat FTS5 (BM25-ranked), dibatasi filter dokumen. */
function searchKeywordRowids(
  question: string,
  limit: number,
  filters?: SearchFilters
): Set<number> {
  const ftsQuery = buildFtsQuery(question);
  if (!ftsQuery) return new Set();

  const { clause, params } = buildDocumentFilter(filters);
  const documentJoin = clause
    ? `JOIN chunks c ON c.rowid = chunks_fts.rowid JOIN documents d ON d.id = c.document_id ${clause}`
    : "";

  try {
    const rows = db
      .prepare(
        `SELECT chunks_fts.rowid as rowid FROM chunks_fts
         ${documentJoin}
         WHERE chunks_fts MATCH ? ORDER BY bm25(chunks_fts) LIMIT ?`
      )
      .all(...params, ftsQuery, limit) as { rowid: number }[];
    return new Set(rows.map((r) => r.rowid));
  } catch {
    // Query FTS5 yang gagal di-parse (karakter tak terduga, dsb) — jangan
    // sampai menggagalkan seluruh pencarian, cukup lewati kata kunci.
    return new Set();
  }
}

/**
 * Jalur pencarian khusus pertanyaan normatif: hanya chunk yang BENAR-BENAR
 * memuat rujukan peraturan (menurut indeks regulation_mentions) yang boleh
 * ikut, lalu diperingkat BM25 terhadap istilah pertanyaan.
 *
 * Urutannya sengaja dua tahap — tentukan NASKAH yang relevan lebih dulu, baru
 * ambil bagian bermuatan peraturan dari naskah itu.
 *
 * Alasannya empiris: untuk "sebutkan peraturan bangunan gedung hijau", BM25
 * memenangkan potongan abstrak yang mengulang "bangunan gedung hijau" belasan
 * kali, sementara kalimat yang benar-benar menyebut PP 16/2021 Pasal 222-226
 * hanya menyebut frasa itu sekali dan kalah telak. Memilih naskahnya dulu
 * membuat pertandingan peringkat terjadi di dalam naskah yang tepat.
 */
function searchRegulationRowids(
  documentIds: string[],
  limit: number
): Set<number> {
  if (documentIds.length === 0) return new Set();

  const placeholders = documentIds.map(() => "?").join(",");
  try {
    const rows = db
      .prepare(
        `SELECT c.rowid as rowid, COUNT(m.id) as mention_count
         FROM chunks c
         JOIN regulation_mentions m ON m.chunk_id = c.id
         WHERE c.document_id IN (${placeholders})
         GROUP BY c.rowid
         ORDER BY mention_count DESC, c.chunk_index ASC
         LIMIT ?`
      )
      .all(...documentIds, limit) as { rowid: number }[];
    return new Set(rows.map((r) => r.rowid));
  } catch {
    return new Set();
  }
}

/**
 * Pencarian hybrid: gabungan cosine similarity (semantik) dan FTS5 (kata
 * kunci literal). Model embedding kecil sering melewatkan istilah/angka
 * spesifik (mis. "1000°C", nama tempat) yang justru mudah ditemukan lewat
 * pencocokan kata literal — dua sinyal ini saling melengkapi. `filters`
 * (tahun/tema) membatasi pencarian ke subset dokumen tertentu.
 */
export function searchSimilarChunks(
  queryVector: number[],
  question: string,
  semanticK = 5,
  keywordK = 5,
  filters?: SearchFilters,
  regulationK = 5
): RetrievedChunk[] {
  const rows = fetchAllEmbeddingRows(filters);
  const scoredByRowid = new Map<number, RetrievedChunk & { rowid: number }>();
  for (const row of rows) {
    scoredByRowid.set(row.chunk_rowid, {
      rowid: row.chunk_rowid,
      document_id: row.document_id,
      filename: row.filename,
      chunk_index: row.chunk_index,
      content: row.content,
      similarity: cosineSimilarity(queryVector, bufferToVector(row.vector)),
      matchedBy: "semantic",
    });
  }

  const semanticTop = Array.from(scoredByRowid.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, semanticK);

  // Sinonim domain hanya dipakai untuk pencarian kata kunci — pertanyaan asli
  // pengguna tetap yang dikirim ke model.
  const expanded = expandQueryTerms(question);

  const keywordRowids = searchKeywordRowids(expanded, keywordK, filters);
  const keywordTop = Array.from(keywordRowids)
    .map((rowid) => scoredByRowid.get(rowid))
    .filter((r): r is RetrievedChunk & { rowid: number } => Boolean(r))
    .map((r) => ({ ...r, matchedBy: "keyword" as const }));

  // Jalur peraturan hanya diaktifkan kalau pertanyaannya memang mencari dasar
  // aturan — supaya pertanyaan riset biasa tidak kehilangan slot konteksnya.
  // Naskah kandidat diambil dari hasil KATA KUNCI lebih dulu, baru semantik.
  // Untuk pertanyaan normatif, istilah pertanyaannya biasanya literal ("bangunan
  // gedung hijau", nomor SNI) sehingga BM25 jauh lebih tepat sasaran; skor
  // cosine model kecil cenderung rata ~0,6 untuk hampir semua naskah dan justru
  // mendorong naskah yang tidak relevan ke daftar kandidat.
  const candidateDocumentIds = Array.from(
    new Set([...keywordTop, ...semanticTop].map((r) => r.document_id))
  ).slice(0, 4);

  const regulationTop = isNormativeQuestion(question)
    ? Array.from(searchRegulationRowids(candidateDocumentIds, regulationK))
        .map((rowid) => scoredByRowid.get(rowid))
        .filter((r): r is RetrievedChunk & { rowid: number } => Boolean(r))
        .map((r) => ({ ...r, matchedBy: "regulation" as const }))
    : [];

  const merged = new Map<number, RetrievedChunk>();
  for (const r of semanticTop) merged.set(r.rowid, r);
  for (const r of keywordTop) {
    // Kalau chunk yang sama juga lolos semantik, pertahankan sebagai
    // "semantic" (skor cosine-nya tetap dipakai untuk pengurutan tampilan).
    if (!merged.has(r.rowid)) merged.set(r.rowid, r);
  }
  for (const r of regulationTop) {
    if (!merged.has(r.rowid)) merged.set(r.rowid, r);
  }

  return Array.from(merged.values())
    .sort((a, b) => b.similarity - a.similarity)
    .map(({ document_id, filename, chunk_index, content, similarity, matchedBy }) => ({
      document_id,
      filename,
      chunk_index,
      content,
      similarity,
      matchedBy,
    }));
}

export function countEmbeddings(): number {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM embeddings")
    .get() as { count: number };
  return row.count;
}

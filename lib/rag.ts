import { sql } from "./db";
import { vectorToPgLiteral } from "./embedding";
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

interface ChunkRow {
  id: string;
  document_id: string;
  filename: string;
  chunk_index: number;
  content: string;
  similarity: number;
}

// Kata umum Bahasa Indonesia yang dibuang dari query pencarian kata kunci
// supaya fokus ke istilah yang benar-benar bermakna, bukan kata tanya.
const STOPWORDS = new Set([
  "apa", "yang", "untuk", "dari", "dan", "atau", "ini", "itu", "adalah",
  "dengan", "pada", "ke", "ada", "bagaimana", "berapa", "siapa", "kapan",
  "mengapa", "kenapa", "tolong", "jelaskan", "sebutkan", "bisa", "akan",
  "juga", "saja", "para", "oleh", "dalam", "secara", "tentang", "sudah",
]);

/** Token yang sudah difilter stopword, digabung jadi tsquery OR ("simple" config, tanpa stemming). */
function buildTsQuery(text: string): string | null {
  const tokens = Array.from(text.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu))
    .map((m) => m[0])
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));

  if (tokens.length === 0) return null;
  // to_tsquery tidak butuh escaping tanda kutip seperti FTS5 karena tokennya
  // sudah dijamin alfanumerik murni oleh regex ekstraksi di atas.
  return tokens.map((t) => `'${t}'`).join(" | ");
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** Fragmen WHERE tambahan untuk filter dokumen (tahun, tema) — kosong kalau tidak difilter. */
function buildDocumentFilter(filters: SearchFilters | undefined) {
  const yearFragment = filters?.year ? sql`AND d.published_year = ${filters.year}` : sql``;

  let topicFragment = sql``;
  if (filters?.topics && filters.topics.length > 0) {
    const conditions = filters.topics.map(
      (topic) => sql`LOWER(d.topics) LIKE ${`%"${escapeLike(topic.toLowerCase())}"%`} ESCAPE '\\'`
    );
    const combined = conditions.reduce((acc, frag) => sql`${acc} OR ${frag}`);
    topicFragment = sql`AND (${combined})`;
  }

  return sql`${yearFragment} ${topicFragment}`;
}

/** Top-K chunk berdasarkan cosine similarity (pgvector, terindeks HNSW). */
async function searchSemantic(
  queryVectorLiteral: string,
  limit: number,
  filters?: SearchFilters
): Promise<ChunkRow[]> {
  const filterFragment = buildDocumentFilter(filters);
  return sql<ChunkRow[]>`
    SELECT c.id, e.document_id, d.filename, c.chunk_index, c.content,
           1 - (e.vector <=> ${queryVectorLiteral}::vector) AS similarity
    FROM embeddings e
    JOIN chunks c ON c.id = e.chunk_id
    JOIN documents d ON d.id = e.document_id
    WHERE 1=1 ${filterFragment}
    ORDER BY e.vector <=> ${queryVectorLiteral}::vector
    LIMIT ${limit}
  `;
}

/**
 * Cari chunk yang cocok secara literal lewat full-text search Postgres
 * (ts_rank, config "simple" — tanpa stemming, sama seperti FTS5 sebelumnya),
 * dibatasi filter dokumen. Similarity tetap dihitung (join ke embeddings)
 * supaya hasil kata kunci bisa digabung & diurutkan bersama hasil semantik.
 */
async function searchKeyword(
  question: string,
  queryVectorLiteral: string,
  limit: number,
  filters?: SearchFilters
): Promise<ChunkRow[]> {
  const tsQuery = buildTsQuery(question);
  if (!tsQuery) return [];

  const filterFragment = buildDocumentFilter(filters);
  try {
    return await sql<ChunkRow[]>`
      SELECT c.id, c.document_id, d.filename, c.chunk_index, c.content,
             1 - (e.vector <=> ${queryVectorLiteral}::vector) AS similarity
      FROM chunks c
      JOIN documents d ON d.id = c.document_id
      JOIN embeddings e ON e.chunk_id = c.id
      WHERE c.content_tsv @@ to_tsquery('simple', ${tsQuery}) ${filterFragment}
      ORDER BY ts_rank(c.content_tsv, to_tsquery('simple', ${tsQuery})) DESC
      LIMIT ${limit}
    `;
  } catch {
    // to_tsquery yang gagal di-parse — jangan sampai menggagalkan seluruh
    // pencarian, cukup lewati sinyal kata kunci.
    return [];
  }
}

/**
 * Jalur pencarian khusus pertanyaan normatif: hanya chunk yang BENAR-BENAR
 * memuat rujukan peraturan (menurut indeks regulation_mentions) yang boleh
 * ikut, lalu diperingkat berdasarkan jumlah rujukan di dalam naskah kandidat.
 *
 * Urutannya sengaja dua tahap — tentukan NASKAH yang relevan lebih dulu, baru
 * ambil bagian bermuatan peraturan dari naskah itu. Lihat catatan lengkap di
 * searchSimilarChunks soal kenapa pendekatan ini dipakai untuk pertanyaan
 * normatif dibanding cosine similarity biasa.
 */
async function searchRegulation(
  documentIds: string[],
  queryVectorLiteral: string,
  limit: number
): Promise<ChunkRow[]> {
  if (documentIds.length === 0) return [];
  try {
    return await sql<ChunkRow[]>`
      SELECT c.id, c.document_id, d.filename, c.chunk_index, c.content,
             1 - (e.vector <=> ${queryVectorLiteral}::vector) AS similarity,
             COUNT(m.id) AS mention_count
      FROM chunks c
      JOIN regulation_mentions m ON m.chunk_id = c.id
      JOIN documents d ON d.id = c.document_id
      JOIN embeddings e ON e.chunk_id = c.id
      WHERE c.document_id IN ${sql(documentIds)}
      GROUP BY c.id, c.document_id, d.filename, c.chunk_index, c.content, e.vector
      ORDER BY mention_count DESC, c.chunk_index ASC
      LIMIT ${limit}
    `;
  } catch {
    return [];
  }
}

function toRetrieved(row: ChunkRow, matchedBy: RetrievedChunk["matchedBy"]): RetrievedChunk {
  return {
    document_id: row.document_id,
    filename: row.filename,
    chunk_index: row.chunk_index,
    content: row.content,
    similarity: Number(row.similarity),
    matchedBy,
  };
}

/**
 * Pencarian hybrid: gabungan cosine similarity (semantik) dan full-text
 * search (kata kunci literal). Model embedding kecil sering melewatkan
 * istilah/angka spesifik (mis. "1000°C", nama tempat) yang justru mudah
 * ditemukan lewat pencocokan kata literal — dua sinyal ini saling melengkapi.
 * `filters` (tahun/tema) membatasi pencarian ke subset dokumen tertentu.
 */
export async function searchSimilarChunks(
  queryVector: number[],
  question: string,
  semanticK = 5,
  keywordK = 5,
  filters?: SearchFilters,
  regulationK = 5
): Promise<RetrievedChunk[]> {
  const queryVectorLiteral = vectorToPgLiteral(queryVector);

  const semanticRows = await searchSemantic(queryVectorLiteral, semanticK, filters);
  const merged = new Map<string, RetrievedChunk & { id: string }>();
  for (const row of semanticRows) {
    merged.set(row.id, { id: row.id, ...toRetrieved(row, "semantic") });
  }

  // Sinonim domain hanya dipakai untuk pencarian kata kunci — pertanyaan asli
  // pengguna tetap yang dikirim ke model.
  const expanded = expandQueryTerms(question);
  const keywordRows = await searchKeyword(expanded, queryVectorLiteral, keywordK, filters);
  for (const row of keywordRows) {
    // Kalau chunk yang sama juga lolos semantik, pertahankan sebagai
    // "semantic" (skor cosine-nya tetap dipakai untuk pengurutan tampilan).
    if (!merged.has(row.id)) merged.set(row.id, { id: row.id, ...toRetrieved(row, "keyword") });
  }

  // Jalur peraturan hanya diaktifkan kalau pertanyaannya memang mencari dasar
  // aturan — supaya pertanyaan riset biasa tidak kehilangan slot konteksnya.
  // Naskah kandidat diambil dari hasil KATA KUNCI lebih dulu, baru semantik.
  if (isNormativeQuestion(question)) {
    const candidateDocumentIds = Array.from(
      new Set([...keywordRows, ...semanticRows].map((r) => r.document_id))
    ).slice(0, 4);
    const regulationRows = await searchRegulation(candidateDocumentIds, queryVectorLiteral, regulationK);
    for (const row of regulationRows) {
      if (!merged.has(row.id)) merged.set(row.id, { id: row.id, ...toRetrieved(row, "regulation") });
    }
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

export async function countEmbeddings(): Promise<number> {
  const [{ count }] = await sql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM embeddings`;
  return count;
}

import { db } from "./db";
import { bufferToVector, cosineSimilarity } from "./embedding";

export interface RetrievedChunk {
  document_id: string;
  filename: string;
  chunk_index: number;
  content: string;
  similarity: number;
}

interface EmbeddingSearchRow {
  vector: Buffer;
  document_id: string;
  chunk_index: number;
  content: string;
  filename: string;
}

/** Brute-force cosine similarity search across every embedded chunk in the DB. */
export function searchSimilarChunks(
  queryVector: number[],
  topK = 5
): RetrievedChunk[] {
  const rows = db
    .prepare(
      `SELECT e.vector, e.document_id, c.chunk_index, c.content, d.filename
       FROM embeddings e
       JOIN chunks c ON c.id = e.chunk_id
       JOIN documents d ON d.id = e.document_id`
    )
    .all() as EmbeddingSearchRow[];

  const scored: RetrievedChunk[] = rows.map((row) => ({
    document_id: row.document_id,
    filename: row.filename,
    chunk_index: row.chunk_index,
    content: row.content,
    similarity: cosineSimilarity(queryVector, bufferToVector(row.vector)),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}

export function countEmbeddings(): number {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM embeddings")
    .get() as { count: number };
  return row.count;
}

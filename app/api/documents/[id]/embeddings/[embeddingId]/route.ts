import { NextResponse } from "next/server";
import { db, type EmbeddingRecord } from "@/lib/db";
import { bufferToVector } from "@/lib/embedding";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/documents/[id]/embeddings/[embeddingId]">
) {
  const { id, embeddingId } = await ctx.params;

  const row = db
    .prepare(
      `SELECT e.*, c.chunk_index as chunk_index, c.content as chunk_content
       FROM embeddings e
       JOIN chunks c ON c.id = e.chunk_id
       WHERE e.id = ? AND e.document_id = ?`
    )
    .get(embeddingId, id) as
    | (EmbeddingRecord & { chunk_index: number; chunk_content: string })
    | undefined;

  if (!row) {
    return NextResponse.json({ error: "Embedding tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({
    embedding: {
      id: row.id,
      chunk_id: row.chunk_id,
      chunk_index: row.chunk_index,
      chunk_content: row.chunk_content,
      model: row.model,
      dimensions: row.dimensions,
      vector: bufferToVector(row.vector),
      created_at: row.created_at,
    },
  });
}

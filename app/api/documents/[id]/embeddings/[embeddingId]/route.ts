import { NextResponse } from "next/server";
import { sql, type EmbeddingRecord } from "@/lib/db";
import { parsePgVector } from "@/lib/embedding";
import { requireAdmin, AuthError } from "@/lib/auth";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/documents/[id]/embeddings/[embeddingId]">
) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id, embeddingId } = await ctx.params;

  const [row] = await sql<(EmbeddingRecord & { chunk_index: number; chunk_content: string })[]>`
    SELECT e.*, c.chunk_index as chunk_index, c.content as chunk_content
    FROM embeddings e
    JOIN chunks c ON c.id = e.chunk_id
    WHERE e.id = ${embeddingId} AND e.document_id = ${id}
  `;

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
      vector: parsePgVector(row.vector),
      created_at: row.created_at,
    },
  });
}

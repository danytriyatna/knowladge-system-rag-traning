import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { sql, type ChunkRecord, type EmbeddingRecord } from "@/lib/db";
import {
  embedTexts,
  vectorToPgLiteral,
  parsePgVector,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
} from "@/lib/embedding";
import { requireAdmin, AuthError } from "@/lib/auth";

// Model embedding lokal didownload sekali di request pertama, dan inference
// untuk dokumen dengan banyak chunk bisa makan waktu beberapa puluh detik.
export const maxDuration = 300;

interface EmbeddingSummary {
  id: string;
  chunk_id: string;
  chunk_index: number;
  model: string;
  dimensions: number;
  preview: number[];
  created_at: string;
}

function toSummary(
  embedding: EmbeddingRecord,
  chunkIndex: number
): EmbeddingSummary {
  const vector = parsePgVector(embedding.vector);
  return {
    id: embedding.id,
    chunk_id: embedding.chunk_id,
    chunk_index: chunkIndex,
    model: embedding.model,
    dimensions: embedding.dimensions,
    preview: vector.slice(0, 8),
    created_at: embedding.created_at,
  };
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/documents/[id]/embeddings">
) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await ctx.params;
  const [document] = await sql<{ id: string }[]>`SELECT id FROM documents WHERE id = ${id}`;

  if (!document) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  }

  const rows = await sql<(EmbeddingRecord & { chunk_index: number })[]>`
    SELECT e.*, c.chunk_index as chunk_index
    FROM embeddings e
    JOIN chunks c ON c.id = e.chunk_id
    WHERE e.document_id = ${id}
    ORDER BY c.chunk_index ASC
  `;

  const embeddings = rows.map((row) => toSummary(row, row.chunk_index));
  return NextResponse.json({ embeddings });
}

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/documents/[id]/embeddings">
) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await ctx.params;
  const [document] = await sql<{ id: string }[]>`SELECT id FROM documents WHERE id = ${id}`;

  if (!document) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  }

  const chunks = await sql<ChunkRecord[]>`
    SELECT * FROM chunks WHERE document_id = ${id} ORDER BY chunk_index ASC
  `;

  if (chunks.length === 0) {
    return NextResponse.json(
      { error: "Belum ada chunk untuk dokumen ini, buat chunk terlebih dahulu" },
      { status: 422 }
    );
  }

  let vectors: number[][];
  try {
    vectors = await embedTexts(chunks.map((c) => c.content));
  } catch {
    return NextResponse.json(
      {
        error:
          "Gagal membuat embedding. Pastikan koneksi internet tersedia saat pertama kali model didownload.",
      },
      { status: 422 }
    );
  }

  const now = new Date().toISOString();
  const records: EmbeddingRecord[] = chunks.map((chunk, i) => ({
    id: randomUUID(),
    chunk_id: chunk.id,
    document_id: id,
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    vector: vectorToPgLiteral(vectors[i]),
    created_at: now,
  }));

  await sql.begin(async (tx) => {
    await tx`DELETE FROM embeddings WHERE document_id = ${id}`;
    for (const record of records) {
      await tx`
        INSERT INTO embeddings (id, chunk_id, document_id, model, dimensions, vector, created_at)
        VALUES (${record.id}, ${record.chunk_id}, ${record.document_id}, ${record.model}, ${record.dimensions}, ${record.vector}::vector, ${record.created_at})
      `;
    }
  });

  const summaries = records.map((record, i) =>
    toSummary(record, chunks[i].chunk_index)
  );

  return NextResponse.json(
    { embeddings: summaries, count: summaries.length },
    { status: 201 }
  );
}

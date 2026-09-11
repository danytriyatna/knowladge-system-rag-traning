import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { sql, type ChunkRecord, type DocumentRecord } from "@/lib/db";
import { chunkText } from "@/lib/chunk";
import { replaceRegulationMentions } from "@/lib/regulations";
import { requireAdmin, AuthError } from "@/lib/auth";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/documents/[id]/chunks">
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

  return NextResponse.json({ chunks });
}

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/documents/[id]/chunks">
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
  const [document] = await sql<DocumentRecord[]>`SELECT * FROM documents WHERE id = ${id}`;

  if (!document) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  }

  if (!document.extracted_text.trim()) {
    return NextResponse.json(
      { error: "Dokumen ini tidak punya teks narasi untuk di-chunk" },
      { status: 422 }
    );
  }

  const pieces = chunkText(document.extracted_text);
  const now = new Date().toISOString();
  const records: ChunkRecord[] = pieces.map((content, index) => ({
    id: randomUUID(),
    document_id: id,
    chunk_index: index,
    content,
    char_count: content.length,
    created_at: now,
  }));

  await sql.begin(async (tx) => {
    await tx`DELETE FROM chunks WHERE document_id = ${id}`;
    if (records.length > 0) {
      await tx`
        INSERT INTO chunks ${tx(records, "id", "document_id", "chunk_index", "content", "char_count", "created_at")}
      `;
    }
  });

  // Panen rujukan peraturan/SNI dari chunk yang baru dibuat, supaya indeks
  // rujukan selalu sinkron dengan chunk yang sedang berlaku.
  const mentionCount = await replaceRegulationMentions(id, records);

  return NextResponse.json(
    { chunks: records, count: records.length, regulationMentions: mentionCount },
    { status: 201 }
  );
}

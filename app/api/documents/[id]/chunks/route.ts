import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db, type ChunkRecord, type DocumentRecord } from "@/lib/db";
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
  const document = db
    .prepare("SELECT id FROM documents WHERE id = ?")
    .get(id) as { id: string } | undefined;

  if (!document) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  }

  const chunks = db
    .prepare(
      "SELECT * FROM chunks WHERE document_id = ? ORDER BY chunk_index ASC"
    )
    .all(id) as ChunkRecord[];

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
  const document = db
    .prepare("SELECT * FROM documents WHERE id = ?")
    .get(id) as DocumentRecord | undefined;

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

  const replaceChunks = db.transaction((chunkRecords: ChunkRecord[]) => {
    db.prepare("DELETE FROM chunks WHERE document_id = ?").run(id);
    const insert = db.prepare(
      `INSERT INTO chunks (id, document_id, chunk_index, content, char_count, created_at)
       VALUES (@id, @document_id, @chunk_index, @content, @char_count, @created_at)`
    );
    for (const record of chunkRecords) insert.run(record);
  });
  replaceChunks(records);

  // Panen rujukan peraturan/SNI dari chunk yang baru dibuat, supaya indeks
  // rujukan selalu sinkron dengan chunk yang sedang berlaku.
  const mentionCount = replaceRegulationMentions(id, records);

  return NextResponse.json(
    { chunks: records, count: records.length, regulationMentions: mentionCount },
    { status: 201 }
  );
}

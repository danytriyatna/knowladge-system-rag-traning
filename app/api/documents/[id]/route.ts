import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { db, type DocumentRecord } from "@/lib/db";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/documents/[id]">
) {
  const { id } = await ctx.params;
  const document = db
    .prepare("SELECT * FROM documents WHERE id = ?")
    .get(id) as DocumentRecord | undefined;

  if (!document) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ document });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/documents/[id]">
) {
  const { id } = await ctx.params;
  const document = db
    .prepare("SELECT * FROM documents WHERE id = ?")
    .get(id) as DocumentRecord | undefined;

  if (!document) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  }

  db.prepare("DELETE FROM embeddings WHERE document_id = ?").run(id);
  db.prepare("DELETE FROM chunks WHERE document_id = ?").run(id);
  db.prepare("DELETE FROM documents WHERE id = ?").run(id);
  await fs.rm(document.stored_path, { force: true });

  return NextResponse.json({ ok: true });
}

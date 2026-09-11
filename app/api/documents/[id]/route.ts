import { NextResponse } from "next/server";
import { sql, type DocumentRecord } from "@/lib/db";
import { deletePdf } from "@/lib/storage";
import { requireUser, requireAdmin, logAudit, AuthError } from "@/lib/auth";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/documents/[id]">
) {
  try {
    await requireUser();
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

  return NextResponse.json({ document });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/documents/[id]">
) {
  let user;
  try {
    user = await requireAdmin();
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

  await sql`DELETE FROM embeddings WHERE document_id = ${id}`;
  await sql`DELETE FROM chunks WHERE document_id = ${id}`;
  await sql`DELETE FROM documents WHERE id = ${id}`;
  await deletePdf(document.stored_path).catch(() => {
    // File mungkin sudah tidak ada (mis. dokumen lama sebelum migrasi Storage) — jangan gagalkan penghapusan record karena ini.
  });
  await logAudit(user.id, "delete_document", id, document.filename);

  return NextResponse.json({ ok: true });
}

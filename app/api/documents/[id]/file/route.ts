import { NextResponse } from "next/server";
import { sql, type DocumentRecord } from "@/lib/db";
import { downloadPdf } from "@/lib/storage";
import { requireUser, AuthError } from "@/lib/auth";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/documents/[id]/file">
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

  let buffer: Buffer;
  try {
    buffer = await downloadPdf(document.stored_path);
  } catch {
    return NextResponse.json(
      { error: "File PDF tidak ditemukan di server" },
      { status: 404 }
    );
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(document.filename)}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

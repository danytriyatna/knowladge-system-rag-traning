import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { db, type DocumentRecord } from "@/lib/db";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/documents/[id]/file">
) {
  const { id } = await ctx.params;
  const document = db
    .prepare("SELECT * FROM documents WHERE id = ?")
    .get(id) as DocumentRecord | undefined;

  if (!document) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(document.stored_path);
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

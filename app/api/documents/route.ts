import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db, pdfDir, type DocumentRecord } from "@/lib/db";
import { extractText } from "@/lib/pdf";

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

export async function GET() {
  const documents = db
    .prepare(
      "SELECT id, filename, page_count, uploaded_at FROM documents ORDER BY uploaded_at DESC"
    )
    .all();
  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "File harus berformat PDF" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Ukuran file maksimal 25MB" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let extracted: { text: string; pageCount: number };
  try {
    extracted = await extractText(buffer);
  } catch {
    return NextResponse.json(
      { error: "Gagal membaca isi PDF, file mungkin rusak atau terkunci" },
      { status: 422 }
    );
  }

  const id = randomUUID();
  const storedPath = path.join(pdfDir, `${id}.pdf`);
  await fs.writeFile(storedPath, buffer);

  const record: DocumentRecord = {
    id,
    filename: file.name,
    stored_path: storedPath,
    extracted_text: extracted.text,
    page_count: extracted.pageCount,
    uploaded_at: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO documents (id, filename, stored_path, extracted_text, page_count, uploaded_at)
     VALUES (@id, @filename, @stored_path, @extracted_text, @page_count, @uploaded_at)`
  ).run(record);

  return NextResponse.json(
    {
      id: record.id,
      filename: record.filename,
      page_count: record.page_count,
      uploaded_at: record.uploaded_at,
    },
    { status: 201 }
  );
}

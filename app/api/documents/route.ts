import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db, pdfDir, type DocumentRecord, type ExtractionMethod } from "@/lib/db";
import { extractText, getPageCount } from "@/lib/pdf";
import { extractTextWithGemini } from "@/lib/gemini";

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

// Dokumen besar lewat mode Gemini bisa makan waktu beberapa menit karena
// setiap halaman diproses sebagai gambar oleh vision model.
export const maxDuration = 300;

export async function GET() {
  const documents = db
    .prepare(
      "SELECT id, filename, extraction_method, page_count, uploaded_at FROM documents ORDER BY uploaded_at DESC"
    )
    .all();
  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const modeInput = formData.get("mode");
  const mode: ExtractionMethod = modeInput === "gemini" ? "gemini" : "local";

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

  let text: string;
  let pageCount: number;
  try {
    if (mode === "gemini") {
      [text, pageCount] = await Promise.all([
        extractTextWithGemini(buffer),
        getPageCount(buffer),
      ]);
    } else {
      const extracted = await extractText(buffer);
      text = extracted.text;
      pageCount = extracted.pageCount;
    }
  } catch (err) {
    const message =
      mode === "gemini"
        ? err instanceof Error && err.message.includes("GEMINI_API_KEY")
          ? "GEMINI_API_KEY belum diset di server, tambahkan di .env.local"
          : "Gagal membaca PDF lewat Gemini API"
        : "Gagal membaca isi PDF, file mungkin rusak atau terkunci";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const id = randomUUID();
  const storedPath = path.join(pdfDir, `${id}.pdf`);
  await fs.writeFile(storedPath, buffer);

  const record: DocumentRecord = {
    id,
    filename: file.name,
    stored_path: storedPath,
    extracted_text: text,
    extraction_method: mode,
    page_count: pageCount,
    uploaded_at: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO documents (id, filename, stored_path, extracted_text, extraction_method, page_count, uploaded_at)
     VALUES (@id, @filename, @stored_path, @extracted_text, @extraction_method, @page_count, @uploaded_at)`
  ).run(record);

  return NextResponse.json(
    {
      id: record.id,
      filename: record.filename,
      extraction_method: record.extraction_method,
      page_count: record.page_count,
      uploaded_at: record.uploaded_at,
    },
    { status: 201 }
  );
}

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { sql, type DocumentRecord, type ExtractionMethod } from "@/lib/db";
import { uploadPdf } from "@/lib/storage";
import { extractText, getPageCount } from "@/lib/pdf";
import { extractTextWithGemini } from "@/lib/gemini";
import { requireUser, requireAdmin, logAudit, AuthError } from "@/lib/auth";

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

// Dokumen besar lewat mode Gemini bisa makan waktu beberapa menit karena
// setiap halaman diproses sebagai gambar oleh vision model.
export const maxDuration = 300;

export async function GET() {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const documents = await sql`
    SELECT id, filename, extraction_method, page_count, uploaded_at,
           title, authors, doi, published_year, volume, issue_number, topics, source
    FROM documents ORDER BY uploaded_at DESC
  `;
  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

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
  const storedPath = await uploadPdf(id, buffer);

  const record: DocumentRecord = {
    id,
    filename: file.name,
    stored_path: storedPath,
    extracted_text: text,
    extraction_method: mode,
    page_count: pageCount,
    uploaded_at: new Date().toISOString(),
    title: file.name.replace(/\.pdf$/i, ""),
    authors: "[]",
    abstract: "",
    doi: "",
    published_year: null,
    volume: "",
    issue_number: "",
    topics: "[]",
    source: "manual_upload",
    ojs_article_id: null,
    synced_at: null,
  };

  await sql`
    INSERT INTO documents (
      id, filename, stored_path, extracted_text, extraction_method, page_count, uploaded_at,
      title, authors, abstract, doi, published_year, volume, issue_number, topics, source,
      ojs_article_id, synced_at
    )
    VALUES (
      ${record.id}, ${record.filename}, ${record.stored_path}, ${record.extracted_text}, ${record.extraction_method}, ${record.page_count}, ${record.uploaded_at},
      ${record.title}, ${record.authors}, ${record.abstract}, ${record.doi}, ${record.published_year}, ${record.volume}, ${record.issue_number}, ${record.topics}, ${record.source},
      ${record.ojs_article_id}, ${record.synced_at}
    )
  `;
  await logAudit(user.id, "manual_upload", record.id, record.filename);

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

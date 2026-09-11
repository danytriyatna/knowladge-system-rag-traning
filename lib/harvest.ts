import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  db,
  pdfDir,
  type DocumentRecord,
  type ChunkRecord,
  type EmbeddingRecord,
} from "./db";
import { fetchAllOaiArticles, downloadGalleyFile, type OaiArticle } from "./ojs";
import { extractText } from "./pdf";
import { extractDocxText, textToPdf } from "./docx";
import { chunkText } from "./chunk";
import { embedTexts, vectorToBuffer, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "./embedding";

export interface HarvestItemResult {
  ojsArticleId: string;
  title: string;
  status: "created" | "skipped_exists" | "skipped_no_pdf" | "failed";
  error?: string;
}

export interface HarvestOutcome {
  syncRunId: string;
  newDocumentsFound: number;
  status: "success" | "partial" | "failed";
  results: HarvestItemResult[];
}

interface ResolvedGalley {
  pdfBuffer: Buffer;
  text: string;
  pageCount: number;
  convertedFromDocx: boolean;
}

/**
 * Siapkan konten PDF + teks yang akan disimpan, dari galley apa pun yang
 * berhasil diunduh:
 * - PDF asli: dibaca langsung.
 * - .docx: teksnya diekstrak (mammoth), lalu dirender ulang jadi PDF (pdf-lib)
 *   supaya naskah tetap punya berkas PDF nyata untuk disimpan & di-embed,
 *   sesuai naskah aslinya (bukan hasil scan/gambar jadi tidak butuh Gemini).
 */
async function resolveGalley(
  article: OaiArticle,
  buffer: Buffer,
  kind: "pdf" | "docx"
): Promise<ResolvedGalley> {
  if (kind === "pdf") {
    const extracted = await extractText(buffer);
    return {
      pdfBuffer: buffer,
      text: extracted.text,
      pageCount: extracted.pageCount,
      convertedFromDocx: false,
    };
  }

  const text = await extractDocxText(buffer);
  if (!text.trim()) {
    throw new Error("Berkas Word tidak berisi teks yang bisa diekstrak");
  }
  const pdfBuffer = await textToPdf(article.title, text);
  const pageCount = await extractText(pdfBuffer).then((e) => e.pageCount);
  return { pdfBuffer, text, pageCount, convertedFromDocx: true };
}

function saveHarvestedArticle(article: OaiArticle, resolved: ResolvedGalley) {
  const id = randomUUID();
  const storedPath = path.join(pdfDir, `${id}.pdf`);

  return fs.writeFile(storedPath, resolved.pdfBuffer).then(async () => {
    const now = new Date().toISOString();
    const record: DocumentRecord = {
      id,
      filename: `${article.title}.pdf`.slice(0, 200),
      stored_path: storedPath,
      extracted_text: resolved.text,
      extraction_method: "local",
      page_count: resolved.pageCount,
      uploaded_at: now,
      title: article.title,
      authors: JSON.stringify(article.authors),
      abstract: article.abstract,
      doi: article.doi,
      published_year: article.publishedYear,
      volume: article.volume,
      issue_number: article.issueNumber,
      topics: JSON.stringify(article.topics),
      source: "ojs_harvest",
      ojs_article_id: article.ojsArticleId,
      synced_at: now,
    };

    db.prepare(
      `INSERT INTO documents (
         id, filename, stored_path, extracted_text, extraction_method, page_count, uploaded_at,
         title, authors, abstract, doi, published_year, volume, issue_number, topics, source,
         ojs_article_id, synced_at
       ) VALUES (
         @id, @filename, @stored_path, @extracted_text, @extraction_method, @page_count, @uploaded_at,
         @title, @authors, @abstract, @doi, @published_year, @volume, @issue_number, @topics, @source,
         @ojs_article_id, @synced_at
       )`
    ).run(record);

    const pieces = chunkText(record.extracted_text);
    const chunkNow = new Date().toISOString();
    const chunkRecords: ChunkRecord[] = pieces.map((content, index) => ({
      id: randomUUID(),
      document_id: id,
      chunk_index: index,
      content,
      char_count: content.length,
      created_at: chunkNow,
    }));
    const insertChunk = db.prepare(
      `INSERT INTO chunks (id, document_id, chunk_index, content, char_count, created_at)
       VALUES (@id, @document_id, @chunk_index, @content, @char_count, @created_at)`
    );
    for (const c of chunkRecords) insertChunk.run(c);

    if (chunkRecords.length > 0) {
      const vectors = await embedTexts(chunkRecords.map((c) => c.content));
      const embedNow = new Date().toISOString();
      const insertEmbedding = db.prepare(
        `INSERT INTO embeddings (id, chunk_id, document_id, model, dimensions, vector, created_at)
         VALUES (@id, @chunk_id, @document_id, @model, @dimensions, @vector, @created_at)`
      );
      chunkRecords.forEach((c, i) => {
        const embeddingRecord: EmbeddingRecord = {
          id: randomUUID(),
          chunk_id: c.id,
          document_id: id,
          model: EMBEDDING_MODEL,
          dimensions: EMBEDDING_DIMENSIONS,
          vector: vectorToBuffer(vectors[i]),
          created_at: embedNow,
        };
        insertEmbedding.run(embeddingRecord);
      });
    }
  });
}

/**
 * Harvest naskah dari OAI-PMH: metadata ditarik lewat ListRecords, PDF diunduh
 * lewat pola URL view->download, lalu setiap naskah baru otomatis diekstrak,
 * di-chunk, dan di-embed (semuanya lokal, tanpa API eksternal untuk tahap ini).
 * Naskah yang sudah ada (dicek lewat ojs_article_id) dilewati, bukan diduplikasi.
 */
export class HarvestAlreadyRunningError extends Error {
  constructor() {
    super(
      "Sinkronisasi lain masih berjalan di server. Tunggu sampai selesai sebelum menjalankan lagi."
    );
    this.name = "HarvestAlreadyRunningError";
  }
}

export async function runHarvest(options: { limit?: number } = {}): Promise<HarvestOutcome> {
  // Cegah dua harvest berjalan bersamaan (mis. karena halaman di-refresh lalu
  // tombol diklik lagi saat run sebelumnya belum selesai) — dua proses yang
  // menulis ke tabel documents bersamaan bisa saling tabrakan (UNIQUE
  // constraint) pada naskah yang sama.
  const STALE_AFTER_MS = 30 * 60 * 1000;
  const alreadyRunning = db
    .prepare("SELECT id, started_at FROM sync_runs WHERE status = 'running' LIMIT 1")
    .get() as { id: string; started_at: string } | undefined;

  if (alreadyRunning) {
    const age = Date.now() - new Date(alreadyRunning.started_at).getTime();
    if (age < STALE_AFTER_MS) {
      throw new HarvestAlreadyRunningError();
    }
    // Run lama kemungkinan terhenti paksa (server restart/crash) — tandai
    // gagal supaya tidak mengunci sinkronisasi berikutnya selamanya.
    db.prepare(
      `UPDATE sync_runs SET finished_at=@finished_at, status='failed',
       error_message='Sinkronisasi terhenti tanpa selesai (kemungkinan server restart)'
       WHERE id=@id`
    ).run({ id: alreadyRunning.id, finished_at: new Date().toISOString() });
  }

  const syncRunId = randomUUID();
  const startedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO sync_runs (id, started_at, new_documents_found, status)
     VALUES (@id, @started_at, 0, 'running')`
  ).run({ id: syncRunId, started_at: startedAt });

  let articles: OaiArticle[];
  try {
    articles = await fetchAllOaiArticles();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mengambil data dari OAI-PMH";
    db.prepare(
      `UPDATE sync_runs SET finished_at=@finished_at, status='failed', error_message=@error_message WHERE id=@id`
    ).run({ id: syncRunId, finished_at: new Date().toISOString(), error_message: message });
    return { syncRunId, newDocumentsFound: 0, status: "failed", results: [] };
  }

  const targets = options.limit ? articles.slice(0, options.limit) : articles;
  const results: HarvestItemResult[] = [];
  let newDocumentsFound = 0;

  for (const article of targets) {
    const existing = db
      .prepare("SELECT id FROM documents WHERE ojs_article_id = ?")
      .get(article.ojsArticleId) as { id: string } | undefined;

    if (existing) {
      results.push({ ojsArticleId: article.ojsArticleId, title: article.title, status: "skipped_exists" });
      continue;
    }

    if (!article.pdfDownloadUrl) {
      results.push({ ojsArticleId: article.ojsArticleId, title: article.title, status: "skipped_no_pdf" });
      continue;
    }

    try {
      const { buffer, kind } = await downloadGalleyFile(article.pdfDownloadUrl);
      if (kind === "unknown") {
        throw new Error(
          `Berkas galley bukan PDF maupun Word yang bisa dikenali (${buffer.length} bytes)`
        );
      }
      const resolved = await resolveGalley(article, buffer, kind);
      await saveHarvestedArticle(article, resolved);
      newDocumentsFound += 1;
      results.push({ ojsArticleId: article.ojsArticleId, title: article.title, status: "created" });
    } catch (err) {
      // Sudah keburu dibuat oleh proses/run lain di antara pengecekan dan
      // penyimpanan (race condition) — anggap sebagai "sudah ada", bukan gagal.
      if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
        results.push({ ojsArticleId: article.ojsArticleId, title: article.title, status: "skipped_exists" });
        continue;
      }
      results.push({
        ojsArticleId: article.ojsArticleId,
        title: article.title,
        status: "failed",
        error: err instanceof Error ? err.message : "Gagal memproses naskah",
      });
    }
  }

  const attempted = results.filter((r) => r.status === "created" || r.status === "failed");
  const failedCount = results.filter((r) => r.status === "failed").length;
  const status: HarvestOutcome["status"] =
    attempted.length === 0 || failedCount === 0
      ? "success"
      : failedCount === attempted.length
        ? "failed"
        : "partial";

  db.prepare(
    `UPDATE sync_runs
     SET finished_at=@finished_at, new_documents_found=@new_documents_found, status=@status, detail=@detail
     WHERE id=@id`
  ).run({
    id: syncRunId,
    finished_at: new Date().toISOString(),
    new_documents_found: newDocumentsFound,
    status,
    detail: JSON.stringify(results),
  });

  return { syncRunId, newDocumentsFound, status, results };
}

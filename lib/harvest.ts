import { randomUUID } from "node:crypto";
import {
  sql,
  type DocumentRecord,
  type ChunkRecord,
} from "./db";
import { uploadPdf } from "./storage";
import { fetchAllOaiArticles, downloadGalleyFile, type OaiArticle } from "./ojs";
import { extractText } from "./pdf";
import { extractDocxText, textToPdf } from "./docx";
import { chunkText } from "./chunk";
import { embedTexts, vectorToPgLiteral, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "./embedding";

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

async function saveHarvestedArticle(article: OaiArticle, resolved: ResolvedGalley) {
  const id = randomUUID();
  const storedPath = await uploadPdf(id, resolved.pdfBuffer);

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

  await sql`
    INSERT INTO documents (
      id, filename, stored_path, extracted_text, extraction_method, page_count, uploaded_at,
      title, authors, abstract, doi, published_year, volume, issue_number, topics, source,
      ojs_article_id, synced_at
    ) VALUES (
      ${record.id}, ${record.filename}, ${record.stored_path}, ${record.extracted_text}, ${record.extraction_method}, ${record.page_count}, ${record.uploaded_at},
      ${record.title}, ${record.authors}, ${record.abstract}, ${record.doi}, ${record.published_year}, ${record.volume}, ${record.issue_number}, ${record.topics}, ${record.source},
      ${record.ojs_article_id}, ${record.synced_at}
    )
  `;

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

  if (chunkRecords.length > 0) {
    await sql`
      INSERT INTO chunks ${sql(chunkRecords, "id", "document_id", "chunk_index", "content", "char_count", "created_at")}
    `;

    const vectors = await embedTexts(chunkRecords.map((c) => c.content));
    const embedNow = new Date().toISOString();
    for (let i = 0; i < chunkRecords.length; i++) {
      const c = chunkRecords[i];
      await sql`
        INSERT INTO embeddings (id, chunk_id, document_id, model, dimensions, vector, created_at)
        VALUES (${randomUUID()}, ${c.id}, ${id}, ${EMBEDDING_MODEL}, ${EMBEDDING_DIMENSIONS}, ${vectorToPgLiteral(vectors[i])}::vector, ${embedNow})
      `;
    }
  }
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
  const [alreadyRunning] = await sql<{ id: string; started_at: string }[]>`
    SELECT id, started_at FROM sync_runs WHERE status = 'running' LIMIT 1
  `;

  if (alreadyRunning) {
    const age = Date.now() - new Date(alreadyRunning.started_at).getTime();
    if (age < STALE_AFTER_MS) {
      throw new HarvestAlreadyRunningError();
    }
    // Run lama kemungkinan terhenti paksa (server restart/crash) — tandai
    // gagal supaya tidak mengunci sinkronisasi berikutnya selamanya.
    await sql`
      UPDATE sync_runs SET finished_at=${new Date().toISOString()}, status='failed',
      error_message='Sinkronisasi terhenti tanpa selesai (kemungkinan server restart)'
      WHERE id=${alreadyRunning.id}
    `;
  }

  const syncRunId = randomUUID();
  const startedAt = new Date().toISOString();
  await sql`
    INSERT INTO sync_runs (id, started_at, new_documents_found, status)
    VALUES (${syncRunId}, ${startedAt}, 0, 'running')
  `;

  let articles: OaiArticle[];
  try {
    articles = await fetchAllOaiArticles();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mengambil data dari OAI-PMH";
    await sql`
      UPDATE sync_runs SET finished_at=${new Date().toISOString()}, status='failed', error_message=${message} WHERE id=${syncRunId}
    `;
    return { syncRunId, newDocumentsFound: 0, status: "failed", results: [] };
  }

  const targets = options.limit ? articles.slice(0, options.limit) : articles;
  const results: HarvestItemResult[] = [];
  let newDocumentsFound = 0;

  for (const article of targets) {
    const [existing] = await sql<{ id: string }[]>`
      SELECT id FROM documents WHERE ojs_article_id = ${article.ojsArticleId}
    `;

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
      const message = err instanceof Error ? err.message : "Gagal memproses naskah";
      if (/duplicate key value violates unique constraint/i.test(message)) {
        results.push({ ojsArticleId: article.ojsArticleId, title: article.title, status: "skipped_exists" });
        continue;
      }
      results.push({
        ojsArticleId: article.ojsArticleId,
        title: article.title,
        status: "failed",
        error: message,
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

  await sql`
    UPDATE sync_runs
    SET finished_at=${new Date().toISOString()}, new_documents_found=${newDocumentsFound}, status=${status}, detail=${JSON.stringify(results)}
    WHERE id=${syncRunId}
  `;

  return { syncRunId, newDocumentsFound, status, results };
}

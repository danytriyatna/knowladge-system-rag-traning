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
  authors?: string[];
  publishedYear?: number | null;
  volume?: string;
  issueNumber?: string;
  doi?: string;
  documentId?: string;
  status: "created" | "skipped_exists" | "skipped_no_pdf" | "failed";
  error?: string;
}

export interface HarvestOutcome {
  syncRunId: string;
  newDocumentsFound: number;
  status: "success" | "partial" | "failed";
  results: HarvestItemResult[];
}

export interface ActiveSyncProgress {
  syncRunId: string;
  status: "running" | "cancelling" | "cancelled" | "success" | "partial" | "failed";
  total: number;
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  currentTitle: string;
  startedAt: string;
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;
  percentage: number;
}

interface ActiveJobState {
  syncRunId: string;
  total: number;
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  currentTitle: string;
  startedAt: number;
  status: "running" | "cancelling" | "cancelled";
  abortController: AbortController;
}

let activeJobState: ActiveJobState | null = null;

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
 *   supaya naskah tetap punya berkas PDF nyata untuk disimpan & di-embed.
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

async function saveHarvestedArticle(article: OaiArticle, resolved: ResolvedGalley): Promise<string> {
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

  return id;
}

export class HarvestAlreadyRunningError extends Error {
  constructor() {
    super(
      "Sinkronisasi lain masih berjalan di server. Tunggu sampai selesai sebelum menjalankan lagi."
    );
    this.name = "HarvestAlreadyRunningError";
  }
}

/**
 * Mengambil status live dari sinkronisasi yang sedang berjalan di memori / database.
 */
export async function getActiveSyncProgress(): Promise<{ isRunning: boolean; activeRun: ActiveSyncProgress | null }> {
  if (activeJobState && activeJobState.status !== "cancelled") {
    const now = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((now - activeJobState.startedAt) / 1000));
    const percentage =
      activeJobState.total > 0
        ? Math.min(100, Math.round((activeJobState.processed / activeJobState.total) * 100))
        : 0;

    let estimatedRemainingSeconds = 0;
    if (activeJobState.processed > 0 && activeJobState.total > activeJobState.processed) {
      const avgSecPerItem = elapsedSeconds / activeJobState.processed;
      const remainingItems = activeJobState.total - activeJobState.processed;
      estimatedRemainingSeconds = Math.round(avgSecPerItem * remainingItems);
    }

    return {
      isRunning: true,
      activeRun: {
        syncRunId: activeJobState.syncRunId,
        status: activeJobState.status,
        total: activeJobState.total,
        processed: activeJobState.processed,
        created: activeJobState.created,
        skipped: activeJobState.skipped,
        failed: activeJobState.failed,
        currentTitle: activeJobState.currentTitle,
        startedAt: new Date(activeJobState.startedAt).toISOString(),
        elapsedSeconds,
        estimatedRemainingSeconds,
        percentage,
      },
    };
  }

  // Cek apakah ada record di DB berstatus 'running' (misal baru refresh)
  const [dbRunning] = await sql<{
    id: string;
    started_at: string;
    total_documents: number;
    processed_count: number;
    new_documents_found: number;
    current_title: string | null;
  }[]>`
    SELECT id, started_at, total_documents, processed_count, new_documents_found, current_title
    FROM sync_runs WHERE status = 'running' ORDER BY started_at DESC LIMIT 1
  `;

  if (dbRunning) {
    const startedTime = new Date(dbRunning.started_at).getTime();
    const age = Date.now() - startedTime;
    if (age < 30 * 60 * 1000) {
      const elapsedSeconds = Math.max(0, Math.floor(age / 1000));
      const total = dbRunning.total_documents || 0;
      const processed = dbRunning.processed_count || 0;
      const percentage = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
      return {
        isRunning: true,
        activeRun: {
          syncRunId: dbRunning.id,
          status: "running",
          total,
          processed,
          created: dbRunning.new_documents_found || 0,
          skipped: Math.max(0, processed - (dbRunning.new_documents_found || 0)),
          failed: 0,
          currentTitle: dbRunning.current_title || "Sinkronisasi sedang berlangsung...",
          startedAt: dbRunning.started_at,
          elapsedSeconds,
          estimatedRemainingSeconds: 0,
          percentage,
        },
      };
    }
  }

  return { isRunning: false, activeRun: null };
}

/**
 * Batalkan sinkronisasi yang sedang berjalan dengan aman (graceful abort).
 */
export async function cancelActiveHarvest(targetRunId?: string): Promise<{ success: boolean; message: string }> {
  if (activeJobState && (!targetRunId || activeJobState.syncRunId === targetRunId)) {
    activeJobState.status = "cancelling";
    activeJobState.abortController.abort();
    await sql`
      UPDATE sync_runs
      SET status = 'cancelled', finished_at = ${new Date().toISOString()},
          error_message = 'Sinkronisasi dibatalkan oleh pengguna'
      WHERE id = ${activeJobState.syncRunId}
    `;
    return { success: true, message: "Sinkronisasi berhasil dibatalkan" };
  }

  const [runningInDb] = await sql<{ id: string }[]>`
    SELECT id FROM sync_runs WHERE status = 'running' ORDER BY started_at DESC LIMIT 1
  `;
  if (runningInDb) {
    await sql`
      UPDATE sync_runs
      SET status = 'cancelled', finished_at = ${new Date().toISOString()},
          error_message = 'Sinkronisasi dibatalkan oleh pengguna'
      WHERE id = ${runningInDb.id}
    `;
    return { success: true, message: "Sinkronisasi berhasil dibatalkan" };
  }

  return { success: false, message: "Tidak ada proses sinkronisasi aktif untuk dibatalkan" };
}

/**
 * Memulai proses sinkronisasi di background (asinkron).
 */
export async function startHarvestBackground(options: { limit?: number } = {}): Promise<{ syncRunId: string }> {
  const STALE_AFTER_MS = 30 * 60 * 1000;

  if (activeJobState && activeJobState.status === "running") {
    throw new HarvestAlreadyRunningError();
  }

  const [alreadyRunning] = await sql<{ id: string; started_at: string }[]>`
    SELECT id, started_at FROM sync_runs WHERE status = 'running' LIMIT 1
  `;

  if (alreadyRunning) {
    const age = Date.now() - new Date(alreadyRunning.started_at).getTime();
    if (age < STALE_AFTER_MS) {
      throw new HarvestAlreadyRunningError();
    }
    await sql`
      UPDATE sync_runs SET finished_at=${new Date().toISOString()}, status='failed',
      error_message='Sinkronisasi terhenti tanpa selesai (kemungkinan server restart)'
      WHERE id=${alreadyRunning.id}
    `;
  }

  const syncRunId = randomUUID();
  const startedAt = new Date().toISOString();
  const abortController = new AbortController();

  await sql`
    INSERT INTO sync_runs (id, started_at, new_documents_found, total_documents, processed_count, status, current_title)
    VALUES (${syncRunId}, ${startedAt}, 0, 0, 0, 'running', 'Menghubungi OJS dan mengambil daftar naskah...')
  `;

  activeJobState = {
    syncRunId,
    total: 0,
    processed: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    currentTitle: "Menghubungi OJS dan mengambil daftar naskah...",
    startedAt: Date.now(),
    status: "running",
    abortController,
  };

  // Jalankan di latar belakang (tanpa await agar respons HTTP langsung kembali)
  executeHarvest(syncRunId, abortController, options).catch((err) => {
    console.error(`[Harvest] Error pada background run ${syncRunId}:`, err);
    activeJobState = null;
  });

  return { syncRunId };
}

/**
 * Loop pemrosesan naskah dengan pengecekan sinyal pembatalan dan pencatatan metrik real-time.
 */
async function executeHarvest(
  syncRunId: string,
  abortController: AbortController,
  options: { limit?: number } = {}
): Promise<HarvestOutcome> {
  let articles: OaiArticle[];
  try {
    articles = await fetchAllOaiArticles();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mengambil data dari OAI-PMH";
    await sql`
      UPDATE sync_runs SET finished_at=${new Date().toISOString()}, status='failed', error_message=${message} WHERE id=${syncRunId}
    `;
    activeJobState = null;
    return { syncRunId, newDocumentsFound: 0, status: "failed", results: [] };
  }

  const targets = options.limit ? articles.slice(0, options.limit) : articles;
  if (activeJobState) {
    activeJobState.total = targets.length;
    activeJobState.currentTitle = `Ditemukan ${targets.length} naskah, memulai pemrosesan...`;
  }

  await sql`
    UPDATE sync_runs SET total_documents=${targets.length}, current_title='Memulai pemrosesan...' WHERE id=${syncRunId}
  `;

  const results: HarvestItemResult[] = [];
  let newDocumentsFound = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (let idx = 0; idx < targets.length; idx++) {
    // Cek pembatalan sebelum memproses naskah berikutnya
    if (abortController.signal.aborted || activeJobState?.status === "cancelling") {
      break;
    }

    const article = targets[idx];
    if (activeJobState) {
      activeJobState.currentTitle = article.title;
      activeJobState.processed = idx + 1;
    }

    const [existing] = await sql<{
      id: string;
      authors: string;
      published_year: number | null;
      volume: string;
      issue_number: string;
      doi: string;
    }[]>`
      SELECT id, authors, published_year, volume, issue_number, doi FROM documents WHERE ojs_article_id = ${article.ojsArticleId}
    `;

    if (existing) {
      let authors = article.authors;
      try {
        if (!authors || authors.length === 0) authors = JSON.parse(existing.authors || "[]");
      } catch {}
      skippedCount++;
      if (activeJobState) activeJobState.skipped = skippedCount;
      results.push({
        ojsArticleId: article.ojsArticleId,
        title: article.title,
        authors,
        publishedYear: article.publishedYear ?? existing.published_year,
        volume: article.volume || existing.volume,
        issueNumber: article.issueNumber || existing.issue_number,
        doi: article.doi || existing.doi,
        documentId: existing.id,
        status: "skipped_exists",
      });
      continue;
    }

    if (!article.pdfDownloadUrl) {
      skippedCount++;
      if (activeJobState) activeJobState.skipped = skippedCount;
      results.push({
        ojsArticleId: article.ojsArticleId,
        title: article.title,
        authors: article.authors,
        publishedYear: article.publishedYear,
        volume: article.volume,
        issueNumber: article.issueNumber,
        doi: article.doi,
        status: "skipped_no_pdf",
      });
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
      const documentId = await saveHarvestedArticle(article, resolved);
      newDocumentsFound += 1;
      if (activeJobState) activeJobState.created = newDocumentsFound;
      results.push({
        ojsArticleId: article.ojsArticleId,
        title: article.title,
        authors: article.authors,
        publishedYear: article.publishedYear,
        volume: article.volume,
        issueNumber: article.issueNumber,
        doi: article.doi,
        documentId,
        status: "created",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memproses naskah";
      if (/duplicate key value violates unique constraint/i.test(message)) {
        skippedCount++;
        if (activeJobState) activeJobState.skipped = skippedCount;
        results.push({
          ojsArticleId: article.ojsArticleId,
          title: article.title,
          authors: article.authors,
          publishedYear: article.publishedYear,
          volume: article.volume,
          issueNumber: article.issueNumber,
          doi: article.doi,
          status: "skipped_exists",
        });
        continue;
      }
      failedCount++;
      if (activeJobState) activeJobState.failed = failedCount;
      results.push({
        ojsArticleId: article.ojsArticleId,
        title: article.title,
        authors: article.authors,
        publishedYear: article.publishedYear,
        volume: article.volume,
        issueNumber: article.issueNumber,
        doi: article.doi,
        status: "failed",
        error: message,
      });
    }

    // Update berkala ke DB setiap 5 item agar tidak membebani database
    if ((idx + 1) % 5 === 0 || idx + 1 === targets.length) {
      await sql`
        UPDATE sync_runs
        SET processed_count=${idx + 1}, new_documents_found=${newDocumentsFound}, current_title=${article.title}
        WHERE id=${syncRunId}
      `;
    }
  }

  const wasCancelled = abortController.signal.aborted || activeJobState?.status === "cancelling";
  const attempted = results.filter((r) => r.status === "created" || r.status === "failed");
  const actualFailed = results.filter((r) => r.status === "failed").length;
  const status: HarvestOutcome["status"] | "cancelled" = wasCancelled
    ? "cancelled"
    : attempted.length === 0 || actualFailed === 0
      ? "success"
      : actualFailed === attempted.length
        ? "failed"
        : "partial";

  await sql`
    UPDATE sync_runs
    SET finished_at=${new Date().toISOString()},
        new_documents_found=${newDocumentsFound},
        processed_count=${results.length},
        total_documents=${targets.length},
        status=${status},
        error_message=${wasCancelled ? "Dibatalkan oleh pengguna" : null},
        detail=${JSON.stringify(results)}
    WHERE id=${syncRunId}
  `;

  activeJobState = null;
  return { syncRunId, newDocumentsFound, status: status === "cancelled" ? "failed" : status, results };
}

/**
 * Fungsi sinkronisasi synchronous klasik (untuk cron / testing otomatis).
 */
export async function runHarvest(options: { limit?: number } = {}): Promise<HarvestOutcome> {
  const { syncRunId } = await startHarvestBackground(options);
  while (activeJobState && activeJobState.syncRunId === syncRunId) {
    await new Promise((r) => setTimeout(r, 400));
  }
  const [row] = await sql<{ new_documents_found: number; status: string; detail: string | null }[]>`
    SELECT new_documents_found, status, detail FROM sync_runs WHERE id=${syncRunId}
  `;
  return {
    syncRunId,
    newDocumentsFound: row?.new_documents_found ?? 0,
    status: (row?.status as HarvestOutcome["status"]) ?? "failed",
    results: row?.detail ? JSON.parse(row.detail) : [],
  };
}

import { randomUUID } from "node:crypto";
import { sql, ensureDocumentPortalSchema, type ChunkRecord, type DocumentSource } from "./db";
import { uploadPdf } from "./storage";
import { textToPdf } from "./docx";
import { extractText } from "./pdf";
import { chunkText } from "./chunk";
import { embedTexts, vectorToPgLiteral, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "./embedding";
import { JP_INSIGHT_DOCUMENTS } from "./jpInsightKnowledge";
import {
  OJS_PORTAL_PAGES,
  resolvePortalUrls,
  extractOjsMainContent,
  computeContentHash,
  type OjsPortalPageSpec,
  type PortalUrlConfig,
} from "./portalExtract";

export {
  OJS_PORTAL_PAGES,
  resolvePortalUrls,
  extractOjsMainContent,
  computeContentHash,
  type OjsPortalPageSpec,
  type PortalUrlConfig,
};

export interface PortalSyncItemResult {
  key: string;
  source: "ojs_portal" | "jp_insight_info";
  title: string;
  sourceUrl: string | null;
  status: "created" | "updated" | "skipped_unchanged" | "failed";
  chunksCount?: number;
  error?: string;
}

export interface PortalSyncSummary {
  crawlBaseUrl: string;
  publicBaseUrl: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  results: PortalSyncItemResult[];
}

async function upsertIndexedDocument(params: {
  source: Extract<DocumentSource, "ojs_portal" | "jp_insight_info">;
  filename: string;
  title: string;
  topics: string[];
  sourceUrl: string | null;
  extractedText: string;
  contentHash: string;
}): Promise<{ status: "created" | "updated" | "skipped_unchanged"; chunksCount: number }> {
  const { source, filename, title, topics, sourceUrl, extractedText, contentHash } = params;

  const existing = sourceUrl
    ? await sql<{ id: string; content_hash: string | null }[]>`
        SELECT id, content_hash
        FROM documents
        WHERE source = ${source} AND (source_url = ${sourceUrl} OR filename = ${filename})
        ORDER BY uploaded_at DESC
        LIMIT 1
      `
    : await sql<{ id: string; content_hash: string | null }[]>`
        SELECT id, content_hash
        FROM documents
        WHERE source = ${source} AND filename = ${filename}
        ORDER BY uploaded_at DESC
        LIMIT 1
      `;

  const existingRow = existing[0];
  if (existingRow && existingRow.content_hash === contentHash) {
    const [{ count }] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM embeddings WHERE document_id = ${existingRow.id}
    `;
    if (count > 0) {
      return { status: "skipped_unchanged", chunksCount: count };
    }
  }

  const pdfBuffer = await textToPdf(title, extractedText);
  const pageCount = await extractText(pdfBuffer)
    .then((e) => Math.max(1, e.pageCount))
    .catch(() => 1);

  const pieces = chunkText(extractedText);
  const vectors = pieces.length > 0 ? await embedTexts(pieces) : [];
  const now = new Date().toISOString();

  if (existingRow) {
    const docId = existingRow.id;
    const storedPath = await uploadPdf(docId, pdfBuffer);
    await sql`
      UPDATE documents
      SET filename = ${filename},
          stored_path = ${storedPath},
          extracted_text = ${extractedText},
          extraction_method = 'local',
          page_count = ${pageCount},
          title = ${title},
          topics = ${JSON.stringify(topics)},
          source_url = ${sourceUrl},
          content_hash = ${contentHash},
          synced_at = ${now}
      WHERE id = ${docId}
    `;

    await sql`DELETE FROM embeddings WHERE document_id = ${docId}`;
    await sql`DELETE FROM chunks WHERE document_id = ${docId}`;

    if (pieces.length > 0) {
      const chunkRecords: ChunkRecord[] = pieces.map((content, index) => ({
        id: randomUUID(),
        document_id: docId,
        chunk_index: index,
        content,
        char_count: content.length,
        created_at: now,
      }));
      await sql`
        INSERT INTO chunks ${sql(chunkRecords, "id", "document_id", "chunk_index", "content", "char_count", "created_at")}
      `;
      for (let i = 0; i < chunkRecords.length; i++) {
        const c = chunkRecords[i];
        await sql`
          INSERT INTO embeddings (id, chunk_id, document_id, model, dimensions, vector, created_at)
          VALUES (${randomUUID()}, ${c.id}, ${docId}, ${EMBEDDING_MODEL}, ${EMBEDDING_DIMENSIONS}, ${vectorToPgLiteral(vectors[i])}::vector, ${now})
        `;
      }
    }

    return { status: "updated", chunksCount: pieces.length };
  }

  const docId = randomUUID();
  const storedPath = await uploadPdf(docId, pdfBuffer);

  await sql`
    INSERT INTO documents (
      id, filename, stored_path, extracted_text, extraction_method, page_count, uploaded_at,
      title, authors, abstract, doi, published_year, volume, issue_number, topics, source,
      ojs_article_id, synced_at, source_url, content_hash
    ) VALUES (
      ${docId}, ${filename}, ${storedPath}, ${extractedText}, 'local', ${pageCount}, ${now},
      ${title}, '[]', '', '', ${null}, '', '', ${JSON.stringify(topics)}, ${source},
      ${null}, ${now}, ${sourceUrl}, ${contentHash}
    )
  `;

  if (pieces.length > 0) {
    const chunkRecords: ChunkRecord[] = pieces.map((content, index) => ({
      id: randomUUID(),
      document_id: docId,
      chunk_index: index,
      content,
      char_count: content.length,
      created_at: now,
    }));
    await sql`
      INSERT INTO chunks ${sql(chunkRecords, "id", "document_id", "chunk_index", "content", "char_count", "created_at")}
    `;
    for (let i = 0; i < chunkRecords.length; i++) {
      const c = chunkRecords[i];
      await sql`
        INSERT INTO embeddings (id, chunk_id, document_id, model, dimensions, vector, created_at)
        VALUES (${randomUUID()}, ${c.id}, ${docId}, ${EMBEDDING_MODEL}, ${EMBEDDING_DIMENSIONS}, ${vectorToPgLiteral(vectors[i])}::vector, ${now})
      `;
    }
  }

  return { status: "created", chunksCount: pieces.length };
}

/**
 * Menyinkronkan dokumentasi profil JP-Insight (jp_insight_info) dan halaman
 * resmi portal web OJS Jurnal Permukiman (ojs_portal) ke indeks RAG.
 */
export async function runPortalAndInfoSync(options?: {
  includePortal?: boolean;
  includeJpInsightInfo?: boolean;
}): Promise<PortalSyncSummary> {
  await ensureDocumentPortalSchema();

  const includePortal = options?.includePortal ?? true;
  const includeJpInsightInfo = options?.includeJpInsightInfo ?? true;
  const { crawlBaseUrl, publicBaseUrl } = resolvePortalUrls();

  const results: PortalSyncItemResult[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  if (includeJpInsightInfo) {
    for (const doc of JP_INSIGHT_DOCUMENTS) {
      try {
        const contentHash = computeContentHash([doc.title, doc.content]);
        const outcome = await upsertIndexedDocument({
          source: "jp_insight_info",
          filename: doc.filename,
          title: doc.title,
          topics: doc.topics,
          sourceUrl: null,
          extractedText: doc.content,
          contentHash,
        });
        if (outcome.status === "created") created++;
        else if (outcome.status === "updated") updated++;
        else skipped++;
        results.push({
          key: doc.key,
          source: "jp_insight_info",
          title: doc.title,
          sourceUrl: null,
          status: outcome.status,
          chunksCount: outcome.chunksCount,
        });
      } catch (err) {
        failed++;
        results.push({
          key: doc.key,
          source: "jp_insight_info",
          title: doc.title,
          sourceUrl: null,
          status: "failed",
          error: err instanceof Error ? err.message : "Gagal menyimpan profil JP-Insight",
        });
      }
    }
  }

  if (includePortal) {
    for (const page of OJS_PORTAL_PAGES) {
      const crawlUrl = `${crawlBaseUrl}/${page.slug}`;
      const publicUrl = `${publicBaseUrl}/${page.slug}`;
      const safeSlug = page.slug.replace(/[^a-zA-Z0-9_-]+/g, "_");
      const filename = `portal-${safeSlug}.pdf`;

      try {
        const res = await fetch(crawlUrl, {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": "JP-Insight-PortalSync/1.0",
          },
          signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} saat mengambil ${crawlUrl}`);
        }
        const html = await res.text();
        const { text } = extractOjsMainContent(html);
        if (text.length < 40) {
          throw new Error("Konten halaman terlalu pendek atau kosong");
        }

        const fullText = `${page.title}\nSumber Resmi: ${publicUrl}\n\n${text}`;
        const contentHash = computeContentHash([page.title, publicUrl, fullText]);
        const outcome = await upsertIndexedDocument({
          source: "ojs_portal",
          filename,
          title: page.title,
          topics: page.topics,
          sourceUrl: publicUrl,
          extractedText: fullText,
          contentHash,
        });

        if (outcome.status === "created") created++;
        else if (outcome.status === "updated") updated++;
        else skipped++;

        results.push({
          key: page.slug,
          source: "ojs_portal",
          title: page.title,
          sourceUrl: publicUrl,
          status: outcome.status,
          chunksCount: outcome.chunksCount,
        });
      } catch (err) {
        failed++;
        results.push({
          key: page.slug,
          source: "ojs_portal",
          title: page.title,
          sourceUrl: publicUrl,
          status: "failed",
          error: err instanceof Error ? err.message : "Gagal sinkronisasi halaman portal",
        });
      }
    }
  }

  return {
    crawlBaseUrl,
    publicBaseUrl,
    created,
    updated,
    skipped,
    failed,
    results,
  };
}

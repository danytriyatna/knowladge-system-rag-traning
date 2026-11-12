import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin, AuthError } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;
  const [row] = await sql<{
    id: string;
    started_at: string;
    finished_at: string | null;
    new_documents_found: number;
    total_documents: number;
    processed_count: number;
    status: string;
    error_message: string | null;
    detail: string | null;
  }[]>`
    SELECT id, started_at, finished_at, new_documents_found, total_documents, processed_count, status, error_message, detail
    FROM sync_runs WHERE id = ${id}
  `;

  if (!row) {
    return NextResponse.json({ error: "Riwayat sinkronisasi tidak ditemukan" }, { status: 404 });
  }

  let items: Array<{
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
  }> = [];

  try {
    items = JSON.parse(row.detail || "[]");
  } catch {
    items = [];
  }

  // Pengkayaan otomatis (retroactive auto-enrich) dari tabel documents jika data penulis belum tersimpan
  const articleIds = items.map((i) => i.ojsArticleId).filter(Boolean);
  if (articleIds.length > 0) {
    try {
      const docRows = await sql<{
        id: string;
        ojs_article_id: string;
        title: string;
        authors: string;
        published_year: number | null;
        volume: string;
        issue_number: string;
        doi: string;
      }[]>`
        SELECT id, ojs_article_id, title, authors, published_year, volume, issue_number, doi
        FROM documents WHERE ojs_article_id IN ${sql(articleIds)}
      `;

      const docMap = new Map(docRows.map((d) => [d.ojs_article_id, d]));
      items = items.map((item) => {
        const doc = docMap.get(item.ojsArticleId);
        if (doc) {
          let authors = item.authors;
          if (!authors || authors.length === 0) {
            try {
              authors = JSON.parse(doc.authors || "[]");
            } catch {
              authors = [];
            }
          }
          return {
            ...item,
            authors: authors ?? [],
            publishedYear: item.publishedYear ?? doc.published_year,
            volume: item.volume || doc.volume,
            issueNumber: item.issueNumber || doc.issue_number,
            doi: item.doi || doc.doi,
            documentId: item.documentId || doc.id,
          };
        }
        return item;
      });
    } catch {
      // Jika enrichment gagal, kembalikan items apa adanya
    }
  }

  return NextResponse.json({
    run: {
      id: row.id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      newDocumentsFound: row.new_documents_found,
      totalDocuments: row.total_documents || items.length,
      processedCount: row.processed_count || items.length,
      status: row.status,
      errorMessage: row.error_message,
      items,
    },
  });
}

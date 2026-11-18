import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { HarvestItemResult } from "@/lib/harvest";
import { requireAdmin, AuthError } from "@/lib/auth";

interface SyncRunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  new_documents_found: number;
  total_documents: number;
  processed_count: number;
  status: string;
  error_message: string | null;
  detail: string | null;
}

function summarize(row: SyncRunRow): string | null {
  if (row.error_message) return row.error_message;
  if (!row.detail) return null;

  let items: HarvestItemResult[];
  try {
    items = JSON.parse(row.detail);
  } catch {
    return null;
  }

  const failed = items.filter((i) => i.status === "failed").length;
  const noPdf = items.filter((i) => i.status === "skipped_no_pdf").length;
  if (failed === 0 && noPdf === 0) return null;

  const parts: string[] = [];
  if (failed > 0) parts.push(`${failed} gagal diproses`);
  if (noPdf > 0) parts.push(`${noPdf} tanpa PDF`);
  return parts.join(", ");
}

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { searchParams } = new URL(request.url);
  const limit = parsePositiveInt(searchParams.get("limit"), 20, 100);
  const requestedPage = parsePositiveInt(searchParams.get("page"), 1, 10000);

  if (process.env.DEV_MODE === "true") {
    return NextResponse.json({
      runs: [
        {
          id: "sync-run-demo-1",
          started_at: new Date(Date.now() - 7200000).toISOString(),
          finished_at: new Date(Date.now() - 7150000).toISOString(),
          new_documents_found: 3,
          status: "completed",
          summary: "Sinkronisasi OAI-PMH berhasil: 3 naskah baru terindeks",
          raw_status: "completed",
        },
      ],
      total: 1,
      page: 1,
      limit,
      totalPages: 1,
    });
  }

  const [{ total }] = await sql<{ total: number }[]>`
    SELECT COUNT(*)::int AS total FROM sync_runs
  `;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * limit;

  const rows = await sql<SyncRunRow[]>`
    SELECT id, started_at, finished_at, new_documents_found, total_documents, processed_count, status, error_message, detail
    FROM sync_runs
    ORDER BY started_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const runs = rows.map((row) => ({
    id: row.id,
    started_at: row.started_at,
    finished_at: row.finished_at,
    new_documents_found: row.new_documents_found,
    total_documents: row.total_documents,
    processed_count: row.processed_count,
    status: row.status,
    error_message: summarize(row),
  }));

  return NextResponse.json({
    runs,
    total,
    page,
    limit,
    totalPages,
  });
}

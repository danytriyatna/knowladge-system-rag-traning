import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { HarvestItemResult } from "@/lib/harvest";
import { requireAdmin, AuthError } from "@/lib/auth";

interface SyncRunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  new_documents_found: number;
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

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const rows = await sql<SyncRunRow[]>`
    SELECT id, started_at, finished_at, new_documents_found, status, error_message, detail
    FROM sync_runs ORDER BY started_at DESC LIMIT 20
  `;

  const runs = rows.map((row) => ({
    id: row.id,
    started_at: row.started_at,
    finished_at: row.finished_at,
    new_documents_found: row.new_documents_found,
    status: row.status,
    error_message: summarize(row),
  }));

  return NextResponse.json({ runs });
}

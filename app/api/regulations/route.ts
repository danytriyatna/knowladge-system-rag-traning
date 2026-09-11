import { NextResponse } from "next/server";
import { requireUser, requireAdmin, logAudit, AuthError } from "@/lib/auth";
import {
  listRegulations,
  listRegulationsForDocument,
  getRegulationDetail,
  findOutdatedEditions,
  backfillRegulationMentions,
  upsertRegulationLink,
  deleteRegulationLink,
} from "@/lib/regulations";

function authError(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}

/**
 * Indeks peraturan/SNI yang dirujuk korpus.
 *
 * - tanpa parameter          : daftar peraturan paling sering dirujuk
 * - ?documentId=...          : peraturan yang dirujuk satu naskah
 * - ?view=outdated           : naskah yang merujuk edisi lama suatu standar
 */
export async function GET(request: Request) {
  try {
    await requireUser();
  } catch (err) {
    const res = authError(err);
    if (res) return res;
    throw err;
  }

  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId");
  const view = url.searchParams.get("view");

  if (view === "outdated") {
    const outdated = findOutdatedEditions();
    return NextResponse.json({
      outdated,
      catatan:
        "Edisi lebih baru terdeteksi di dalam korpus ini. Sistem belum punya data status resmi, jadi ini BUKAN pernyataan bahwa edisi lama sudah dicabut.",
    });
  }

  const nomor = url.searchParams.get("nomor");
  if (nomor) {
    const detail = getRegulationDetail(nomor);
    if (!detail) {
      return NextResponse.json(
        { error: "Peraturan tidak ditemukan di indeks rujukan" },
        { status: 404 }
      );
    }
    return NextResponse.json({ detail });
  }

  if (documentId) {
    return NextResponse.json({
      regulations: listRegulationsForDocument(documentId),
    });
  }

  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? limitParam : 100;
  return NextResponse.json({ regulations: listRegulations(limit) });
}

/** Simpan tautan sumber resmi (JDIH) untuk satu peraturan. */
export async function PUT(request: Request) {
  let user;
  try {
    user = await requireAdmin();
  } catch (err) {
    const res = authError(err);
    if (res) return res;
    throw err;
  }

  const body = await request.json().catch(() => null);
  const nomor = typeof body?.nomor === "string" ? body.nomor.trim() : "";
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const judulResmi = typeof body?.judul_resmi === "string" ? body.judul_resmi : "";

  if (!nomor) {
    return NextResponse.json({ error: "Nomor peraturan wajib diisi" }, { status: 400 });
  }

  // URL kosong berarti menghapus tautan yang sudah ada.
  if (!url) {
    deleteRegulationLink(nomor);
    logAudit(user.id, "delete_regulation_link", nomor);
    return NextResponse.json({ link: null });
  }

  try {
    const link = upsertRegulationLink({
      nomor_lengkap: nomor,
      url,
      judul_resmi: judulResmi,
      curated_by: user.id,
    });
    logAudit(user.id, "set_regulation_link", nomor, url);
    return NextResponse.json({ link });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tautan tidak valid" },
      { status: 400 }
    );
  }
}

/** Panen ulang rujukan untuk seluruh korpus (backfill sekali jalan). */
export async function POST() {
  let user;
  try {
    user = await requireAdmin();
  } catch (err) {
    const res = authError(err);
    if (res) return res;
    throw err;
  }

  const result = backfillRegulationMentions();
  logAudit(
    user.id,
    "backfill_regulation_mentions",
    undefined,
    `${result.mentions} rujukan dari ${result.documents} dokumen`
  );

  return NextResponse.json(result);
}

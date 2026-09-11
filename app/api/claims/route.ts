import { NextResponse } from "next/server";
import { requireUser, requireAdmin, logAudit, AuthError } from "@/lib/auth";
import type { ClaimKind } from "@/lib/db";
import {
  listGapClaims,
  countGapClaims,
  findGapCandidates,
  harvestGaps,
  type GapFilters,
} from "@/lib/claims";

// Panen memanggil model sekali per potongan kandidat, jadi butuh jendela
// waktu lebih panjang daripada endpoint biasa — dibatasi 300 (maksimum
// plan Hobby Vercel; naikkan bila plan di-upgrade).
export const maxDuration = 300;

function authError(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}

/** Daftar pernyataan celah riset yang sudah dipanen dari naskah. */
export async function GET(request: Request) {
  try {
    await requireUser();
  } catch (err) {
    const res = authError(err);
    if (res) return res;
    throw err;
  }

  const url = new URL(request.url);
  const filters: GapFilters = {};

  const jenis = url.searchParams.get("jenis");
  if (jenis === "keterbatasan" || jenis === "saran_lanjutan") {
    filters.jenis = jenis as ClaimKind;
  }
  const search = url.searchParams.get("search");
  if (search) filters.search = search;
  const year = Number(url.searchParams.get("year"));
  if (Number.isInteger(year) && year > 0) filters.year = year;

  const [claims, ringkasan, kandidat] = await Promise.all([
    listGapClaims(filters),
    countGapClaims(),
    findGapCandidates(),
  ]);

  return NextResponse.json({
    claims,
    ringkasan,
    kandidat: kandidat.length,
  });
}

/** Jalankan panen celah riset atas korpus (admin). */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAdmin();
  } catch (err) {
    const res = authError(err);
    if (res) return res;
    throw err;
  }

  const body = await request.json().catch(() => null);
  const documentId = typeof body?.documentId === "string" ? body.documentId : undefined;
  const limit = Number.isInteger(body?.limit) && body.limit > 0 ? body.limit : undefined;

  try {
    const outcome = await harvestGaps({ documentId, limit });
    await logAudit(
      user.id,
      "harvest_gap_claims",
      documentId,
      `${outcome.claims} pernyataan dari ${outcome.processed} potongan (gagal: ${outcome.failed})`
    );
    return NextResponse.json(outcome);
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("GEMINI_API_KEY")
        ? "GEMINI_API_KEY belum diset di server, tambahkan di .env.local"
        : "Gagal menjalankan panen celah riset";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

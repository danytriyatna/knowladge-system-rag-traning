"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface GapClaim {
  id: string;
  document_id: string;
  jenis: "keterbatasan" | "saran_lanjutan";
  teks: string;
  kutipan: string;
  topik: string;
  filename: string;
  title: string;
  published_year: number | null;
  chunk_index: number;
}

interface Ringkasan {
  total: number;
  keterbatasan: number;
  saran: number;
  documents: number;
}

type JenisFilter = "semua" | "keterbatasan" | "saran_lanjutan";

const JENIS_LABEL: Record<GapClaim["jenis"], string> = {
  keterbatasan: "Keterbatasan",
  saran_lanjutan: "Saran Lanjutan",
};

const JENIS_CLASS: Record<GapClaim["jenis"], string> = {
  keterbatasan: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  saran_lanjutan: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
};

export default function GapPanel({ isAdmin }: { isAdmin: boolean }) {
  const [claims, setClaims] = useState<GapClaim[] | null>(null);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [kandidat, setKandidat] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState("");
  const [jenis, setJenis] = useState<JenisFilter>("semua");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [harvesting, setHarvesting] = useState(false);
  const [harvestNote, setHarvestNote] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams();
    if (jenis !== "semua") params.set("jenis", jenis);
    if (search.trim()) params.set("search", search.trim());

    fetch(`/api/claims?${params.toString()}`)
      .then((r) => r.json().then((d) => [r.ok, d] as const))
      .then(([ok, data]) => {
        if (ignore) return;
        if (!ok) throw new Error(data.error ?? "Gagal memuat celah riset");
        setClaims(data.claims ?? []);
        setRingkasan(data.ringkasan ?? null);
        setKandidat(data.kandidat ?? 0);
        setError(null);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        setError(err instanceof Error ? err.message : "Gagal memuat celah riset");
      });
    return () => {
      ignore = true;
    };
  }, [reloadKey, jenis, search]);

  async function handleHarvest() {
    setHarvesting(true);
    setHarvestNote(null);
    setError(null);
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Panen gagal");
      setHarvestNote(
        `${data.claims} pernyataan dipanen dari ${data.processed} potongan kandidat` +
          (data.failed > 0 ? ` (${data.failed} potongan gagal diproses)` : "")
      );
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Panen gagal");
    } finally {
      setHarvesting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted">
          Celah riset yang dinyatakan sendiri oleh penulis naskah — bagian keterbatasan
          penelitian dan saran penelitian lanjutan. Berguna sebagai titik awal mencari
          topik yang masih terbuka untuk diteliti.
        </p>
        {isAdmin && (
          <button
            onClick={handleHarvest}
            disabled={harvesting}
            className="press shrink-0 rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
          >
            {harvesting ? "Memanen..." : "Panen Ulang Celah Riset"}
          </button>
        )}
      </div>

      {harvesting && (
        <p className="fade-in text-xs text-muted">
          Memeriksa {kandidat} potongan naskah kandidat satu per satu. Proses ini memanggil
          model untuk memilah celah riset dari keterbatasan program, jadi butuh beberapa
          menit. Jangan tutup halaman ini.
        </p>
      )}
      {harvestNote && <p className="fade-in text-sm text-muted">{harvestNote}</p>}
      {error && <p className="fade-in text-sm text-red-600 dark:text-red-400">{error}</p>}

      {ringkasan && (
        <div className="flex flex-wrap gap-3">
          {[
            ["Pernyataan", ringkasan.total],
            ["Naskah", ringkasan.documents],
            ["Keterbatasan", ringkasan.keterbatasan],
            ["Saran lanjutan", ringkasan.saran],
          ].map(([label, val]) => (
            <div
              key={label as string}
              className="rounded-xl border border-border bg-surface px-4 py-3"
            >
              <div className="text-lg font-semibold text-foreground">{val as number}</div>
              <div className="text-xs text-muted">{label as string}</div>
            </div>
          ))}
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari topik atau isi pernyataan, mis. septic tank, beton, tsunami..."
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      />

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["semua", "Semua"],
            ["saran_lanjutan", "Saran Lanjutan"],
            ["keterbatasan", "Keterbatasan"],
          ] as [JenisFilter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setJenis(key)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              jenis === key
                ? "border-transparent bg-accent-soft text-accent-text"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {claims === null && <p className="text-sm text-muted">Memuat...</p>}
      {claims && claims.length === 0 && (
        <p className="text-sm text-muted">
          {ringkasan?.total === 0
            ? "Belum ada celah riset yang dipanen. Jalankan “Panen Ulang Celah Riset” untuk memindai korpus."
            : "Tidak ada pernyataan yang cocok dengan pencarian atau filter ini."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {claims?.map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs ${JENIS_CLASS[c.jenis]}`}>
                {JENIS_LABEL[c.jenis]}
              </span>
              {c.topik && <span className="text-xs text-muted">{c.topik}</span>}
              {c.published_year && (
                <span className="text-xs text-muted">· {c.published_year}</span>
              )}
            </div>

            <p className="text-sm text-foreground">{c.teks}</p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Link
                href={`/documents/${c.document_id}`}
                className="text-xs text-accent-text hover:underline"
              >
                {(c.title || c.filename).slice(0, 80)}
              </Link>
              <button
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                className="text-xs text-muted transition-colors hover:text-foreground"
              >
                {expanded === c.id ? "Sembunyikan kutipan asli" : "Lihat kutipan asli"}
              </button>
            </div>

            {expanded === c.id && (
              <div className="fade-in mt-2 rounded-lg border-l-2 border-accent bg-background p-3">
                <p className="text-sm italic text-muted">&ldquo;{c.kutipan}&rdquo;</p>
                <p className="mt-1 text-xs text-muted">
                  Bagian {c.chunk_index + 1} dari naskah. Kutipan ini diverifikasi ada di
                  teks naskah sebelum pernyataan disimpan.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {ringkasan && ringkasan.total > 0 && (
        <p className="mt-2 text-xs text-muted">
          Daftar ini memuat celah yang <strong>dinyatakan penulis</strong> di dalam naskah,
          bukan hasil analisis sistem atas apa yang belum pernah diteliti. Cakupannya
          terbatas pada {ringkasan.documents} naskah Jurnal Permukiman yang memuat
          pernyataan semacam ini.
        </p>
      )}
    </div>
  );
}

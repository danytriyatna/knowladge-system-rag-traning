"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface RegulationSummary {
  jenis: string;
  nomor_normal: string;
  nomor_lengkap: string;
  tahun: number | null;
  mention_count: number;
  document_count: number;
}

interface OutdatedEdition {
  nomor_normal: string;
  dirujuk: string;
  tahun_dirujuk: number;
  edisi_terbaru: string;
  tahun_terbaru: number;
  document_id: string;
  filename: string;
  title: string;
}

interface RegulationDetail {
  jenis: string;
  nomor_normal: string;
  nomor_lengkap: string;
  tahun: number | null;
  judul: string | null;
  judul_varian: string[];
  pasal_disebut: string[];
  link: { url: string; judul_resmi: string; curated_at: string } | null;
  jdih_search_url: string;
  editions: { nomor_lengkap: string; tahun: number | null; document_count: number }[];
  documents: {
    document_id: string;
    filename: string;
    title: string;
    published_year: number | null;
    snippets: { chunk_index: number; text: string }[];
  }[];
}

type View = "terbanyak" | "edisi";

const JENIS_CLASS: Record<string, string> = {
  SNI: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  PERMEN: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
  PP: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  UU: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  PERPRES: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  SE: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const JENIS_FILTERS = ["SNI", "PERMEN", "PP", "UU", "PERPRES"] as const;

function badgeClass(jenis: string) {
  return JENIS_CLASS[jenis] ?? JENIS_CLASS.SE;
}

export default function RegulationsPanel({ isAdmin }: { isAdmin: boolean }) {
  const [view, setView] = useState<View>("terbanyak");
  const [regulations, setRegulations] = useState<RegulationSummary[] | null>(null);
  const [outdated, setOutdated] = useState<OutdatedEdition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState("");
  const [jenisFilter, setJenisFilter] = useState<string | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<RegulationDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailKey, setDetailKey] = useState(0);

  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [savingLink, setSavingLink] = useState(false);

  // Fetch di-inline di dalam effect (pola yang sama dengan SyncPanel) supaya
  // tidak ada pemanggilan fungsi pengubah state langsung dari effect.
  // `reloadKey` dinaikkan setelah backfill untuk memicu muat ulang.
  useEffect(() => {
    let ignore = false;
    Promise.all([
      fetch("/api/regulations?limit=500").then((r) => r.json().then((d) => [r.ok, d] as const)),
      fetch("/api/regulations?view=outdated").then((r) => r.json().then((d) => [r.ok, d] as const)),
    ])
      .then(([[okTop, dataTop], [okOld, dataOld]]) => {
        if (ignore) return;
        if (!okTop) throw new Error(dataTop.error ?? "Gagal memuat daftar peraturan");
        if (!okOld) throw new Error(dataOld.error ?? "Gagal memuat deteksi edisi");
        setRegulations(dataTop.regulations ?? []);
        setOutdated(dataOld.outdated ?? []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        setError(err instanceof Error ? err.message : "Gagal memuat data peraturan");
      });
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  // Muat rincian peraturan yang dipilih.
  useEffect(() => {
    if (!selected) return;
    let ignore = false;
    fetch(`/api/regulations?nomor=${encodeURIComponent(selected)}`)
      .then((r) => r.json().then((d) => [r.ok, d] as const))
      .then(([ok, data]) => {
        if (ignore) return;
        if (!ok) throw new Error(data.error ?? "Gagal memuat rincian peraturan");
        setDetail(data.detail);
        setDetailError(null);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        setDetailError(err instanceof Error ? err.message : "Gagal memuat rincian");
      });
    return () => {
      ignore = true;
    };
  }, [selected, detailKey]);

  async function saveLink(nomor: string, hapus = false) {
    setSavingLink(true);
    setLinkError(null);
    try {
      const res = await fetch("/api/regulations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomor,
          url: hapus ? "" : linkUrl.trim(),
          judul_resmi: hapus ? "" : linkTitle.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan tautan");
      setLinkUrl("");
      setLinkTitle("");
      setDetailKey((k) => k + 1);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Gagal menyimpan tautan");
    } finally {
      setSavingLink(false);
    }
  }

  async function handleBackfill() {
    setBackfilling(true);
    setError(null);
    try {
      const res = await fetch("/api/regulations", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memanen ulang rujukan");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memanen ulang rujukan");
    } finally {
      setBackfilling(false);
    }
  }

  function openDetail(nomor: string) {
    setSelected(nomor);
    setDetail(null);
    setDetailError(null);
    setLinkUrl("");
    setLinkTitle("");
    setLinkError(null);
  }

  const filtered = useMemo(() => {
    if (!regulations) return null;
    const q = search.trim().toLowerCase();
    return regulations.filter((r) => {
      if (jenisFilter && r.jenis !== jenisFilter) return false;
      if (!q) return true;
      return (
        r.nomor_lengkap.toLowerCase().includes(q) ||
        r.nomor_normal.toLowerCase().includes(q) ||
        String(r.tahun ?? "").includes(q)
      );
    });
  }, [regulations, search, jenisFilter]);

  const filteredOutdated = useMemo(() => {
    if (!outdated) return null;
    const q = search.trim().toLowerCase();
    if (!q) return outdated;
    return outdated.filter(
      (o) =>
        o.dirujuk.toLowerCase().includes(q) ||
        o.edisi_terbaru.toLowerCase().includes(q) ||
        (o.title || o.filename).toLowerCase().includes(q)
    );
  }, [outdated, search]);

  // ---- Tampilan rincian satu peraturan ----
  if (selected) {
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => setSelected(null)}
          className="self-start text-sm text-muted transition-colors hover:text-foreground"
        >
          &larr; Kembali ke daftar peraturan
        </button>

        {detailError && (
          <p className="fade-in text-sm text-red-600 dark:text-red-400">{detailError}</p>
        )}
        {!detail && !detailError && <p className="text-sm text-muted">Memuat rincian...</p>}

        {detail && (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClass(detail.jenis)}`}>
                  {detail.jenis}
                </span>
                <h2 className="text-lg font-semibold tracking-tight">{detail.nomor_lengkap}</h2>
              </div>
              {detail.judul && (
                <p className="text-base text-foreground">
                  tentang <span className="font-medium">{detail.judul}</span>
                </p>
              )}
              <p className="text-sm text-muted">
                Dirujuk oleh {detail.documents.length} naskah di korpus.
              </p>
              {detail.judul_varian.length > 0 && (
                <p className="text-xs text-muted">
                  Penulisan judul lain yang ditemukan di naskah:{" "}
                  {detail.judul_varian.join(" · ")}
                </p>
              )}
            </div>

            {/* Rujukan ke sumber resmi. URL persis dikurasi admin — nomor
                identitas dokumen di JDIH tidak bisa diturunkan dari nomor
                peraturan, jadi menebaknya berisiko menunjuk aturan lain. */}
            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="mb-2 text-sm font-medium text-foreground">Sumber resmi</h3>
              {detail.link ? (
                <>
                  <a
                    href={detail.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-accent-text hover:underline"
                  >
                    {detail.link.judul_resmi || detail.link.url} ↗
                  </a>
                  <p className="mt-1 text-xs text-muted">
                    Ditetapkan kurator pada{" "}
                    {new Date(detail.link.curated_at).toLocaleDateString("id-ID")}.
                  </p>
                </>
              ) : (
                <>
                  <a
                    href={detail.jdih_search_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent-text hover:underline"
                  >
                    Cari &ldquo;{detail.nomor_lengkap}&rdquo; di JDIH BPK ↗
                  </a>
                  <p className="mt-1 text-xs text-muted">
                    Tautan resmi peraturan ini belum ditetapkan, jadi ini baru pencarian
                    dan hasilnya bisa meleset.
                  </p>
                </>
              )}

              {isAdmin && (
                <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                  <label className="text-xs text-muted">
                    Tempel URL resmi dari peraturan.bpk.go.id / jdih.pu.go.id
                  </label>
                  <input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://peraturan.bpk.go.id/Details/285541/permen-pupr-no-5-tahun-2008"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <input
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="Judul resmi (opsional)"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => saveLink(detail.nomor_lengkap)}
                      disabled={savingLink}
                      className="press rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {savingLink ? "Menyimpan..." : "Simpan tautan"}
                    </button>
                    {detail.link && (
                      <button
                        onClick={() => saveLink(detail.nomor_lengkap, true)}
                        disabled={savingLink}
                        className="rounded-full border border-border px-4 py-1.5 text-xs text-muted transition-colors hover:text-red-600 disabled:opacity-50"
                      >
                        Hapus tautan
                      </button>
                    )}
                  </div>
                  {linkError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{linkError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Batas kejujuran: teks asli peraturan belum ada di sistem, jadi
                seluruh isi di halaman ini berasal dari naskah yang merujuk. */}
            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="mb-2 text-sm font-medium text-foreground">Isi peraturan</h3>
              {detail.pasal_disebut.length > 0 ? (
                <>
                  <p className="mb-2 text-xs text-muted">
                    Pasal yang dikutip naskah saat merujuk peraturan ini:
                  </p>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {detail.pasal_disebut.map((p) => (
                      <span
                        key={p}
                        className="rounded-full border border-border px-3 py-1 text-xs text-foreground"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mb-3 text-sm text-muted">
                  Tidak ada naskah yang menyebut pasal tertentu dari peraturan ini.
                </p>
              )}
              <p className="text-xs text-muted">
                Teks asli peraturan ini <strong>belum ada di sistem</strong>. Judul dan
                pasal di atas dipungut dari kalimat naskah yang merujuknya, dan kutipan di
                bawah adalah isi menurut naskah tersebut &mdash; bukan salinan bunyi
                pasalnya. Untuk membaca bunyi aslinya, teks peraturan perlu diunggah lebih
                dulu.
              </p>
            </div>

            {detail.editions.length > 1 && (
              <div className="rounded-xl border border-border bg-surface p-4">
                <h3 className="mb-2 text-sm font-medium text-foreground">
                  Edisi lain yang beredar di korpus
                </h3>
                <div className="flex flex-wrap gap-2">
                  {detail.editions.map((e) => (
                    <button
                      key={e.nomor_lengkap}
                      onClick={() => openDetail(e.nomor_lengkap)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        e.nomor_lengkap === detail.nomor_lengkap
                          ? "border-transparent bg-accent-soft text-accent-text"
                          : "border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {e.nomor_lengkap} &middot; {e.document_count} naskah
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Beberapa edisi terdeteksi. Sistem belum punya data status resmi, jadi ini
                  bukan pernyataan bahwa edisi lama sudah dicabut.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-medium text-muted">
                Apa kata naskah yang merujuk
              </h3>
              {detail.documents.map((doc) => (
                <div
                  key={doc.document_id}
                  className="rounded-xl border border-border bg-surface p-4"
                >
                  <Link
                    href={`/documents/${doc.document_id}`}
                    className="text-sm font-medium text-accent-text hover:underline"
                  >
                    {doc.title || doc.filename}
                  </Link>
                  {doc.published_year && (
                    <span className="ml-2 text-xs text-muted">{doc.published_year}</span>
                  )}
                  <ul className="mt-2 flex flex-col gap-2">
                    {doc.snippets.map((s) => (
                      <li key={s.chunk_index} className="text-sm text-muted">
                        <span className="mr-2 text-xs text-muted">bagian {s.chunk_index + 1}</span>
                        {s.text}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ---- Tampilan daftar ----
  const totalRujukan = filtered?.reduce((sum, r) => sum + r.mention_count, 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted">
          Peraturan dan SNI yang dirujuk di dalam naskah korpus, dipanen otomatis dari
          teks naskah. Klik salah satu untuk melihat naskah mana yang merujuknya dan di
          kalimat apa.
        </p>
        {isAdmin && (
          <button
            onClick={handleBackfill}
            disabled={backfilling}
            className="press shrink-0 rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
          >
            {backfilling ? "Memanen ulang..." : "Panen Ulang Rujukan"}
          </button>
        )}
      </div>

      {error && <p className="fade-in text-sm text-red-600 dark:text-red-400">{error}</p>}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari nomor peraturan, mis. 1726, PP 16, SNI 6389, 2021..."
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["terbanyak", "Paling Sering Dirujuk"],
            ["edisi", `Edisi Lama (${outdated?.length ?? 0})`],
          ] as [View, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              view === key
                ? "bg-accent-soft text-accent-text"
                : "text-muted hover:bg-background hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "terbanyak" && (
        <>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setJenisFilter(null)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                jenisFilter === null
                  ? "border-transparent bg-accent-soft text-accent-text"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              Semua
            </button>
            {JENIS_FILTERS.map((j) => (
              <button
                key={j}
                onClick={() => setJenisFilter(jenisFilter === j ? null : j)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  jenisFilter === j
                    ? "border-transparent bg-accent-soft text-accent-text"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                {j}
              </button>
            ))}
          </div>

          {filtered && (
            <p className="text-xs text-muted">
              {filtered.length} peraturan &middot; {totalRujukan} penyebutan
            </p>
          )}
          {regulations === null && <p className="text-sm text-muted">Memuat...</p>}
          {filtered && filtered.length === 0 && (
            <p className="text-sm text-muted">
              Tidak ada peraturan yang cocok dengan pencarian atau filter ini.
            </p>
          )}
          {filtered && filtered.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Jenis</th>
                    <th className="px-3 py-2 font-medium">Nomor</th>
                    <th className="px-3 py-2 font-medium">Naskah</th>
                    <th className="px-3 py-2 font-medium">Penyebutan</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.nomor_lengkap}
                      onClick={() => openDetail(r.nomor_lengkap)}
                      className="cursor-pointer border-t border-border transition-colors hover:bg-surface"
                    >
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClass(r.jenis)}`}>
                          {r.jenis}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-foreground">
                        {r.nomor_lengkap}
                      </td>
                      <td className="px-3 py-2 text-foreground">{r.document_count}</td>
                      <td className="px-3 py-2 text-muted">{r.mention_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {view === "edisi" && (
        <>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            Daftar ini menunjukkan naskah yang merujuk edisi lebih lama, sementara korpus
            yang sama sudah memuat edisi yang lebih baru. Sistem belum punya data status
            resmi, jadi ini <strong>bukan</strong> pernyataan bahwa edisi lama sudah
            dicabut &mdash; penetapan status tetap perlu diperiksa kurator.
          </div>
          {outdated === null && <p className="text-sm text-muted">Memuat...</p>}
          {filteredOutdated && filteredOutdated.length === 0 && (
            <p className="text-sm text-muted">
              Tidak ada rujukan ke edisi lama yang cocok dengan pencarian ini.
            </p>
          )}
          {filteredOutdated && filteredOutdated.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Dirujuk</th>
                    <th className="px-3 py-2 font-medium">Edisi Terbaru di Korpus</th>
                    <th className="px-3 py-2 font-medium">Naskah</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOutdated.map((o) => (
                    <tr
                      key={`${o.document_id}-${o.dirujuk}`}
                      className="border-t border-border transition-colors hover:bg-surface"
                    >
                      <td className="whitespace-nowrap px-3 py-2">
                        <button
                          onClick={() => openDetail(o.dirujuk)}
                          className="font-medium text-accent-text hover:underline"
                        >
                          {o.dirujuk}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <button
                          onClick={() => openDetail(o.edisi_terbaru)}
                          className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 hover:underline dark:bg-emerald-950 dark:text-emerald-400"
                        >
                          {o.edisi_terbaru}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-muted">
                        <Link
                          href={`/documents/${o.document_id}`}
                          className="hover:text-foreground hover:underline"
                        >
                          {o.title || o.filename}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

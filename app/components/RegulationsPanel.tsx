"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  BookOpen,
  Search,
  ExternalLink,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  FileText,
  Bookmark,
  CheckCircle2,
} from "lucide-react";

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
  SNI: "bg-blue-100 text-blue-800 border-blue-200",
  PERMEN: "bg-indigo-100 text-indigo-800 border-indigo-200",
  PP: "bg-emerald-100 text-emerald-800 border-emerald-200",
  UU: "bg-amber-100 text-amber-800 border-amber-200",
  PERPRES: "bg-orange-100 text-orange-800 border-orange-200",
  SE: "bg-slate-100 text-slate-800 border-slate-200",
};

const JENIS_FILTERS = ["SNI", "PERMEN", "PP", "UU", "PERPRES"] as const;

function badgeClass(jenis: string) {
  return JENIS_CLASS[jenis] ?? JENIS_CLASS.SE;
}

export default function RegulationsPanel({ isAdmin }: { isAdmin: boolean }) {
  const [regulations, setRegulations] = useState<RegulationSummary[] | null>(null);
  const [outdated, setOutdated] = useState<OutdatedEdition[] | null>(null);
  const [selectedNomor, setSelectedNomor] = useState<string | null>(null);
  const [detail, setDetail] = useState<RegulationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [jenisFilter, setJenisFilter] = useState<string | null>(null);
  const [view, setView] = useState<View>("terbanyak");

  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [backfilling, setBackfilling] = useState(false);

  async function loadList() {
    try {
      const res = await fetch("/api/regulations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat regulasi");
      setRegulations(data.regulations ?? []);
      setOutdated(data.outdated ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat regulasi");
    }
  }

  useEffect(() => {
    let ignore = false;
    fetch("/api/regulations")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          setRegulations(data.regulations ?? []);
          setOutdated(data.outdated ?? []);
        }
      })
      .catch(() => {
        if (!ignore) setError("Gagal memuat regulasi");
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function openDetail(nomorLengkap: string) {
    setSelectedNomor(nomorLengkap);
    setDetailLoading(true);
    setDetail(null);
    setLinkError(null);
    try {
      const res = await fetch(`/api/regulations?nomor=${encodeURIComponent(nomorLengkap)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat rincian regulasi");
      setDetail(data);
      setLinkUrl(data.link?.url ?? "");
      setLinkTitle(data.link?.judul_resmi ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat rincian regulasi");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedNomor(null);
    setDetail(null);
  }

  async function saveLink(nomorLengkap: string, remove = false) {
    setSavingLink(true);
    setLinkError(null);
    try {
      const method = remove ? "DELETE" : "PUT";
      const res = await fetch("/api/regulations", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomor_lengkap: nomorLengkap,
          url: linkUrl,
          judul_resmi: linkTitle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan tautan");
      await openDetail(nomorLengkap);
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
      if (!res.ok) throw new Error(data.error ?? "Panen regulasi gagal");
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Panen regulasi gagal");
    } finally {
      setBackfilling(false);
    }
  }

  const filtered = useMemo(() => {
    if (!regulations) return null;
    return regulations.filter((r) => {
      if (jenisFilter && r.jenis !== jenisFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchNomor = r.nomor_lengkap.toLowerCase().includes(q);
        const matchTahun = r.tahun ? String(r.tahun).includes(q) : false;
        if (!matchNomor && !matchTahun) return false;
      }
      return true;
    });
  }, [regulations, jenisFilter, search]);

  const filteredOutdated = useMemo(() => {
    if (!outdated) return null;
    if (!search.trim()) return outdated;
    const q = search.toLowerCase();
    return outdated.filter(
      (o) =>
        o.dirujuk.toLowerCase().includes(q) ||
        o.edisi_terbaru.toLowerCase().includes(q) ||
        o.title.toLowerCase().includes(q)
    );
  }, [outdated, search]);

  if (selectedNomor) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={closeDetail} className="gap-1.5 rounded-xl text-xs font-semibold">
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Daftar
          </Button>
          <span className="text-xs text-[#64748B]">&bull;</span>
          <span className="font-mono text-xs font-semibold text-[#0B254B]">{selectedNomor}</span>
        </div>

        {detailLoading && <p className="text-sm text-[#64748B]">Memuat data rincian regulasi...</p>}

        {detail && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${badgeClass(detail.jenis)}`}>
                    {detail.jenis}
                  </span>
                  <h2 className="text-xl font-extrabold text-[#0B254B]">
                    {detail.nomor_lengkap}
                  </h2>
                </div>
                {detail.judul && (
                  <p className="text-base text-[#1C1917] font-medium leading-relaxed mt-1">
                    tentang {detail.judul}
                  </p>
                )}
                <p className="mt-2 text-xs text-[#64748B]">
                  Dirujuk oleh <strong className="text-[#0B254B]">{detail.documents.length}</strong> naskah di dalam korpus.
                </p>
                {detail.judul_varian.length > 0 && (
                  <p className="mt-1 text-xs text-[#64748B]">
                    Varian judul lain: {detail.judul_varian.join(" · ")}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Sumber Resmi */}
            <Card>
              <CardContent className="p-6">
                <h3 className="mb-2 text-sm font-bold text-[#0B254B]">Tautan Sumber Resmi</h3>
                {detail.link ? (
                  <div>
                    <a
                      href={detail.link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#123B72] hover:underline"
                    >
                      <span>{detail.link.judul_resmi || detail.link.url}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <p className="mt-1 text-xs text-[#64748B]">
                      Tautan resmi dikurasi pada {new Date(detail.link.curated_at).toLocaleDateString("id-ID")}.
                    </p>
                  </div>
                ) : (
                  <div>
                    <a
                      href={detail.jdih_search_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#123B72] hover:underline"
                    >
                      <span>Cari &ldquo;{detail.nomor_lengkap}&rdquo; di JDIH BPK</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <p className="mt-1 text-xs text-[#64748B]">
                      Tautan resmi peraturan ini belum ditetapkan kurator.
                    </p>
                  </div>
                )}

                {isAdmin && (
                  <div className="mt-4 flex flex-col gap-3 border-t border-[#D9E1EC] pt-4">
                    <label className="text-xs font-semibold text-[#0B254B]">
                      Atur Tautan Resmi (peraturan.bpk.go.id / jdih.pu.go.id)
                    </label>
                    <Input
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://peraturan.bpk.go.id/Details/..."
                    />
                    <Input
                      value={linkTitle}
                      onChange={(e) => setLinkTitle(e.target.value)}
                      placeholder="Judul resmi peraturan (opsional)"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveLink(detail.nomor_lengkap)}
                        disabled={savingLink}
                      >
                        {savingLink ? "Menyimpan..." : "Simpan Tautan"}
                      </Button>
                      {detail.link && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveLink(detail.nomor_lengkap, true)}
                          disabled={savingLink}
                          className="hover:text-red-600"
                        >
                          Hapus Tautan
                        </Button>
                      )}
                    </div>
                    {linkError && <p className="text-xs text-red-600">{linkError}</p>}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pasal Disebut */}
            <Card>
              <CardContent className="p-6">
                <h3 className="mb-2 text-sm font-bold text-[#0B254B]">Pasal yang Dikutip Naskah</h3>
                {detail.pasal_disebut.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {detail.pasal_disebut.map((p) => (
                      <Badge key={p} variant="secondary" className="text-xs font-medium">
                        {p}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#64748B]">
                    Tidak ada naskah yang menyebut pasal spesifik dari peraturan ini.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Apa kata naskah yang merujuk */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold text-[#0B254B]">
                Kutipan Pembahasan dari Naskah ({detail.documents.length} Dokumen)
              </h3>
              {detail.documents.map((doc) => (
                <Card key={doc.document_id} className="p-5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#123B72]" />
                    <Link
                      href={`/documents/${doc.document_id}`}
                      className="text-sm font-bold text-[#123B72] hover:underline"
                    >
                      {doc.title || doc.filename}
                    </Link>
                    {doc.published_year && (
                      <span className="text-xs text-[#64748B]">({doc.published_year})</span>
                    )}
                  </div>
                  <ul className="mt-3 flex flex-col gap-2">
                    {doc.snippets.map((s) => (
                      <li key={s.chunk_index} className="rounded-lg bg-[#F8FAFD] p-3 text-xs text-[#334155] leading-relaxed">
                        <span className="font-semibold text-[#123B72] mr-1.5">[Bagian {s.chunk_index + 1}]</span>
                        {s.text}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Tampilan Daftar Regulasi
  const totalRujukan = filtered?.reduce((sum, r) => sum + r.mention_count, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="max-w-2xl">
            <h3 className="text-base font-bold text-[#0B254B]">Basis Regulasi &amp; SNI yang Dirujuk</h3>
            <p className="mt-1 text-sm text-[#64748B]">
              Peraturan perundang-undangan dan Standar Nasional Indonesia (SNI) bidang permukiman yang
              dipanen otomatis dari daftar rujukan naskah ilmiah.
            </p>
          </div>
          {isAdmin && (
            <Button
              onClick={handleBackfill}
              disabled={backfilling}
              className="gap-2 rounded-xl font-semibold shadow-xs"
            >
              <RefreshCw className={`h-4 w-4 ${backfilling ? "animate-spin" : ""}`} />
              {backfilling ? "Memanen Ulang..." : "Panen Ulang Rujukan"}
            </Button>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor peraturan, mis. SNI 1726, PP 16, Permen PUPR..."
            className="pl-10 h-11"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={view === "terbanyak" ? "default" : "outline"}
            onClick={() => setView("terbanyak")}
            className="rounded-full text-xs"
          >
            Paling Sering Dirujuk
          </Button>
          <Button
            size="sm"
            variant={view === "edisi" ? "default" : "outline"}
            onClick={() => setView("edisi")}
            className="rounded-full text-xs"
          >
            Edisi Lama ({outdated?.length ?? 0})
          </Button>
        </div>
      </div>

      {view === "terbanyak" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant={jenisFilter === null ? "default" : "outline"}
              onClick={() => setJenisFilter(null)}
              className="rounded-full text-xs h-7 px-3"
            >
              Semua Jenis
            </Button>
            {JENIS_FILTERS.map((j) => (
              <Button
                key={j}
                size="sm"
                variant={jenisFilter === j ? "default" : "outline"}
                onClick={() => setJenisFilter(jenisFilter === j ? null : j)}
                className="rounded-full text-xs h-7 px-3"
              >
                {j}
              </Button>
            ))}
          </div>

          {filtered && (
            <p className="text-xs text-[#64748B]">
              Menampilkan <strong className="text-[#0B254B]">{filtered.length}</strong> peraturan &middot;{" "}
              <strong>{totalRujukan}</strong> total penyebutan
            </p>
          )}

          {regulations === null && <p className="text-sm text-[#64748B]">Memuat regulasi...</p>}
          {filtered && filtered.length === 0 && (
            <Card className="p-8 text-center text-sm text-[#64748B]">
              Tidak ada peraturan yang cocok dengan pencarian &ldquo;{search}&rdquo;.
            </Card>
          )}

          {filtered && filtered.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Jenis</TableHead>
                  <TableHead>Nomor Regulasi</TableHead>
                  <TableHead className="text-center w-28">Naskah</TableHead>
                  <TableHead className="text-center w-28">Penyebutan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow
                    key={r.nomor_lengkap}
                    onClick={() => openDetail(r.nomor_lengkap)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${badgeClass(r.jenis)}`}>
                        {r.jenis}
                      </span>
                    </TableCell>
                    <TableCell className="font-bold text-[#0B254B]">
                      {r.nomor_lengkap}
                    </TableCell>
                    <TableCell className="text-center font-semibold text-[#123B72]">
                      {r.document_count} naskah
                    </TableCell>
                    <TableCell className="text-center text-[#64748B]">
                      {r.mention_count} kali
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {view === "edisi" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 leading-relaxed">
            <span>
              Daftar ini menandai naskah yang merujuk edisi SNI/regulasi lama, sementara korpus telah
              memuat naskah dengan edisi yang lebih baru (mis. SNI gempa 2002 vs 2012 vs 2019).
            </span>
          </div>

          {filteredOutdated && filteredOutdated.length === 0 && (
            <Card className="p-8 text-center text-sm text-[#64748B]">
              Tidak ada rujukan edisi lama yang terdeteksi.
            </Card>
          )}

          {filteredOutdated && filteredOutdated.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Edisi Dirujuk</TableHead>
                  <TableHead>Edisi Terbaru di Korpus</TableHead>
                  <TableHead>Naskah Sumber</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOutdated.map((o) => (
                  <TableRow key={`${o.document_id}-${o.dirujuk}`}>
                    <TableCell>
                      <button
                        onClick={() => openDetail(o.dirujuk)}
                        className="font-bold text-[#123B72] hover:underline cursor-pointer"
                      >
                        {o.dirujuk}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="success" className="cursor-pointer" onClick={() => openDetail(o.edisi_terbaru)}>
                        {o.edisi_terbaru}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/documents/${o.document_id}`}
                        className="font-medium text-[#0B254B] hover:underline text-xs"
                      >
                        {o.title || o.filename}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}

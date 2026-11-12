"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Search, ChevronRight, AlertCircle, FileText } from "lucide-react";

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

const JENIS_CONFIG: Record<
  GapClaim["jenis"],
  { label: string; variant: "warning" | "secondary" }
> = {
  keterbatasan: { label: "Keterbatasan", variant: "warning" },
  saran_lanjutan: { label: "Saran Lanjutan", variant: "secondary" },
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
    fetch("/api/claims")
      .then((res) => res.json())
      .then((data) => {
        if (ignore) return;
        setClaims(data.claims ?? []);
        setRingkasan(data.ringkasan ?? null);
        setKandidat(data.kandidat_count ?? 0);
      })
      .catch(() => {
        if (!ignore) setError("Gagal memuat celah riset");
      });
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  async function handleHarvest() {
    setHarvesting(true);
    setError(null);
    setHarvestNote(null);
    try {
      const res = await fetch("/api/claims", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Panen celah riset gagal");
      setHarvestNote(`Panen selesai: ${data.added ?? 0} pernyataan baru ditambahkan.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Panen celah riset gagal");
    } finally {
      setHarvesting(false);
    }
  }

  const filtered = (claims ?? []).filter((c) => {
    if (jenis !== "semua" && c.jenis !== jenis) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTeks = c.teks.toLowerCase().includes(q);
      const matchTopik = c.topik.toLowerCase().includes(q);
      const matchTitle = (c.title || c.filename).toLowerCase().includes(q);
      if (!matchTeks && !matchTopik && !matchTitle) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="max-w-2xl">
            <h3 className="text-base font-bold text-[#0B254B]">Eksplorasi Celah Riset Ilmiah</h3>
            <p className="mt-1 text-sm text-[#64748B]">
              Celah riset yang dinyatakan sendiri oleh para penulis naskah—meliputi aspek keterbatasan
              penelitian serta saran penelitian lanjutan untuk mengidentifikasi topik riset strategis permukiman.
            </p>
          </div>
          {isAdmin && (
            <Button
              onClick={handleHarvest}
              disabled={harvesting}
              className="gap-2 rounded-xl font-semibold shadow-xs"
            >
              <Sparkles className={`h-4 w-4 ${harvesting ? "animate-spin" : ""}`} />
              {harvesting ? "Memanen Celah Riset..." : "Panen Ulang Celah Riset"}
            </Button>
          )}
        </CardContent>
      </Card>

      {harvesting && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-[#EEF4FC] p-4 text-xs text-[#0B254B]">
          <span className="h-2 w-2 rounded-full bg-[#123B72] animate-ping" />
          <span>
            Sedang menganalisis {kandidat} potongan naskah menggunakan LLM lokal/cloud untuk memilah celah riset.
            Mohon tidak menutup halaman ini.
          </span>
        </div>
      )}

      {harvestNote && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <span>{harvestNote}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {ringkasan && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Pernyataan Celah", val: ringkasan.total, color: "text-[#0B254B]" },
            { label: "Naskah Sumber", val: ringkasan.documents, color: "text-[#123B72]" },
            { label: "Keterbatasan", val: ringkasan.keterbatasan, color: "text-amber-700" },
            { label: "Saran Lanjutan", val: ringkasan.saran, color: "text-blue-700" },
          ].map((item) => (
            <Card key={item.label} className="p-4">
              <div className={`text-2xl font-extrabold ${item.color}`}>{item.val}</div>
              <div className="mt-1 text-xs font-medium text-[#64748B]">{item.label}</div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari topik atau isi pernyataan, mis. pelat lantai, beton, gempa..."
            className="pl-10 h-11"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: "semua", label: "Semua Kategori" },
            { key: "saran_lanjutan", label: "Saran Lanjutan" },
            { key: "keterbatasan", label: "Keterbatasan" },
          ].map((opt) => (
            <Button
              key={opt.key}
              size="sm"
              variant={jenis === opt.key ? "default" : "outline"}
              onClick={() => setJenis(opt.key as JenisFilter)}
              className="rounded-full text-xs"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {claims === null && <p className="text-sm text-[#64748B]">Memuat data celah riset...</p>}
      {claims && claims.length === 0 && (
        <Card className="p-8 text-center text-sm text-[#64748B]">
          Belum ada data celah riset diindeks.
        </Card>
      )}
      {claims && claims.length > 0 && filtered.length === 0 && (
        <Card className="p-8 text-center text-sm text-[#64748B]">
          Tidak ditemukan celah riset yang sesuai dengan kata kunci &ldquo;{search}&rdquo;.
        </Card>
      )}

      {filtered.length > 0 && (
        <div className="flex flex-col gap-3">
          {filtered.map((c) => {
            const isExpanded = expanded === c.id;
            const config = JENIS_CONFIG[c.jenis];
            return (
              <Card key={c.id} className="overflow-hidden border-[#D9E1EC]">
                <div className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={config.variant}>
                        {config.label}
                      </Badge>
                      {c.topik && (
                        <Badge variant="outline" className="text-xs">
                          {c.topik}
                        </Badge>
                      )}
                    </div>
                    <Link
                      href={`/documents/${c.document_id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#123B72] hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {c.title || c.filename}
                      {c.published_year ? ` (${c.published_year})` : ""}
                    </Link>
                  </div>

                  <p className="text-sm font-semibold text-[#0B254B] leading-relaxed">
                    {c.teks}
                  </p>

                  <div className="mt-3">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : c.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#64748B] hover:text-[#123B72] cursor-pointer"
                    >
                      <ChevronRight
                        className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      />
                      <span>{isExpanded ? "Sembunyikan kutipan asli" : "Lihat kutipan asli dari naskah"}</span>
                    </button>
                    {isExpanded && (
                      <div className="mt-2 rounded-xl border border-[#D9E1EC] bg-[#F8FAFD] p-4 text-xs italic text-[#1C1917] leading-relaxed animate-in fade-in-50">
                        &ldquo;{c.kutipan}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

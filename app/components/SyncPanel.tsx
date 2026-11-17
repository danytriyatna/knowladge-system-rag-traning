"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  FileText,
  Search,
  ExternalLink,
  ChevronRight,
  Loader2,
} from "lucide-react";

interface SyncRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  new_documents_found: number;
  total_documents?: number;
  processed_count?: number;
  status: "running" | "success" | "partial" | "failed" | "cancelled";
  error_message: string | null;
}

interface ActiveSyncProgress {
  syncRunId: string;
  status: "running" | "cancelling" | "cancelled" | "success" | "partial" | "failed";
  total: number;
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  currentTitle: string;
  startedAt: string;
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;
  percentage: number;
}

interface RunItemDetail {
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
}

interface RunFullDetail {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  newDocumentsFound: number;
  totalDocuments: number;
  processedCount: number;
  status: string;
  errorMessage: string | null;
  items: RunItemDetail[];
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }
> = {
  running: { label: "Berjalan", variant: "default" },
  success: { label: "Berhasil", variant: "success" },
  partial: { label: "Sebagian", variant: "warning" },
  failed: { label: "Gagal", variant: "destructive" },
  cancelled: { label: "Dibatalkan", variant: "warning" },
};

function formatDuration(sec: number): string {
  if (sec <= 0) return "0 detik";
  if (sec < 60) return `${sec} detik`;
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${mins}m ${remSec}d`;
}

export default function SyncPanel({ onSynced }: { onSynced?: () => void }) {
  const [runs, setRuns] = useState<SyncRun[] | null>(null);
  const [progress, setProgress] = useState<ActiveSyncProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalDetail, setModalDetail] = useState<RunFullDetail | null>(null);
  const [modalSearch, setModalSearch] = useState("");
  const [modalFilterStatus, setModalFilterStatus] = useState<string>("all");

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/status");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat status sinkronisasi");
      setRuns(data.runs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat status sinkronisasi");
    }
  }, []);

  // Cek progress sinkronisasi yang sedang berjalan
  const checkProgress = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/progress");
      if (!res.ok) return;
      const data: { isRunning: boolean; activeRun: ActiveSyncProgress | null } = await res.json();

      if (data.isRunning && data.activeRun) {
        setProgress(data.activeRun);
        setRunning(true);
      } else {
        // Jika sebelumnya running lalu selesai
        if (running) {
          setRunning(false);
          setProgress(null);
          setCancelling(false);
          await loadRuns();
          onSynced?.();
          setSuccessNotice("Proses sinkronisasi telah selesai.");
        }
      }
    } catch {
      // Abaikan error jaringan sementara saat polling
    }
  }, [running, loadRuns, onSynced]);

  // Initial load
  useEffect(() => {
    loadRuns();
    checkProgress();
  }, [loadRuns, checkProgress]);

  // Polling interval saat sinkronisasi aktif
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      checkProgress();
    }, 1500);
    return () => clearInterval(interval);
  }, [running, checkProgress]);

  // Jalankan sinkronisasi baru secara asinkron (background)
  async function handleRunSync() {
    setRunning(true);
    setError(null);
    setSuccessNotice(null);
    setCancelling(false);

    try {
      const res = await fetch("/api/sync/ojs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "async" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memulai sinkronisasi");

      // Langsung panggil checkProgress untuk update state live
      await checkProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memulai sinkronisasi");
      setRunning(false);
    }
  }

  // Batalkan proses sinkronisasi aktif
  async function handleCancelSync() {
    if (!confirm("Apakah Anda yakin ingin membatalkan proses sinkronisasi ini?")) {
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch("/api/sync/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncRunId: progress?.syncRunId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membatalkan sinkronisasi");
      await checkProgress();
      await loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membatalkan sinkronisasi");
      setCancelling(false);
    }
  }

  // Buka modal detail rincian naskah
  async function handleOpenDetail(runId: string) {
    setModalOpen(true);
    setModalLoading(true);
    setModalDetail(null);
    setModalSearch("");
    setModalFilterStatus("all");

    try {
      const res = await fetch(`/api/sync/runs/${runId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat rincian naskah");
      setModalDetail(data.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat rincian naskah");
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  }

  // Filter naskah di dalam modal
  const filteredModalItems = useMemo(() => {
    if (!modalDetail?.items) return [];
    const q = modalSearch.trim().toLowerCase();

    return modalDetail.items.filter((item) => {
      // Filter status
      if (modalFilterStatus !== "all" && item.status !== modalFilterStatus) {
        return false;
      }
      // Filter teks pencarian (judul / penulis)
      if (!q) return true;
      const authorsStr = (item.authors ?? []).join(" ").toLowerCase();
      const titleStr = item.title.toLowerCase();
      return titleStr.includes(q) || authorsStr.includes(q);
    });
  }, [modalDetail, modalSearch, modalFilterStatus]);

  return (
    <div className="flex flex-col gap-6">
      {/* Kartu Header Kontrol Sinkronisasi */}
      <Card className="border border-[#D9E1EC] bg-white shadow-xs">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="max-w-2xl">
            <h3 className="text-base font-bold text-[#0B254B]">Sinkronisasi Otomatis OJS</h3>
            <p className="mt-1 text-sm text-[#64748B]">
              Tarik seluruh naskah terbit dari arsip OJS Jurnal Permukiman (OAI-PMH) lalu unduh PDF,
              ekstrak teks, potong chunk, dan buat embedding vektor secara otomatis ke basis data lokal.
            </p>
          </div>
          <Button
            onClick={handleRunSync}
            disabled={running}
            className="rounded-xl px-5 py-2.5 font-semibold shadow-xs"
          >
            <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
            {running ? "Sinkronisasi Berjalan..." : "Jalankan Sinkronisasi Sekarang"}
          </Button>
        </CardContent>
      </Card>

      {/* Kartu LIVE PROGRESS BAR (Tampil Otomatis Saat Sinkronisasi Aktif) */}
      {running && progress && (
        <Card className="border-2 border-[#123B72]/30 bg-gradient-to-b from-[#F8FAFD] to-white shadow-md animate-in fade-in-0 duration-300">
          <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF4FC] text-[#123B72]">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0B254B]">
                    Sinkronisasi Sedang Berlangsung di Latar Belakang
                  </h4>
                  <p className="text-xs text-[#64748B]">
                    Anda bebas berpindah ke tab lain, proses tetap berjalan di server lokal.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancelSync}
                  disabled={cancelling}
                  className="gap-1.5 font-bold shadow-xs"
                >
                  <XCircle className="h-4 w-4" />
                  {cancelling ? "Membatalkan..." : "Batalkan Sinkronisasi"}
                </Button>
              </div>
            </div>

            {/* Progress Bar KemenPU */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-[#0B254B]">
                  Progres: {progress.processed} dari {progress.total > 0 ? progress.total : "?"} naskah
                </span>
                <span className="text-[#123B72] font-bold text-sm">
                  {progress.percentage}%
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                <div
                  className="h-full bg-gradient-to-r from-[#123B72] via-[#1E569C] to-[#EAB308] transition-all duration-300 ease-out"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>

            {/* Sub-Metrik Detail */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6ECF5] pt-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {progress.created} Naskah Baru
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  {progress.skipped} Dilewati (Sudah Ada)
                </Badge>
                {progress.failed > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    {progress.failed} Gagal
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 text-stone-500 font-medium">
                <Clock className="h-3.5 w-3.5 text-[#123B72]" />
                <span>Berjalan: {formatDuration(progress.elapsedSeconds)}</span>
                {progress.estimatedRemainingSeconds > 0 && (
                  <span>· Estimasi sisa: ~{formatDuration(progress.estimatedRemainingSeconds)}</span>
                )}
              </div>
            </div>

            {/* Judul Naskah yang Sedang Diproses */}
            {progress.currentTitle && (
              <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-[#F4F7FC] p-3 text-xs text-[#0B254B]">
                <Clock className="h-4 w-4 shrink-0 text-[#123B72] animate-pulse mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-500 text-[11px] uppercase tracking-wider">
                    Sedang Diproses:
                  </p>
                  <p className="truncate font-bold text-[#0B254B] mt-0.5">
                    {progress.currentTitle}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pesan Sukses / Error */}
      {successNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successNotice}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabel Riwayat Riil Sinkronisasi */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#0B254B]">Riwayat Riil Sinkronisasi</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadRuns}
            className="h-8 gap-1.5 text-xs text-[#123B72] hover:bg-[#EEF4FC]"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Segarkan Riwayat
          </Button>
        </div>

        {runs === null && <p className="text-sm text-[#64748B]">Memuat riwayat...</p>}
        {runs && runs.length === 0 && (
          <Card className="rounded-xl p-8 text-center text-sm text-[#64748B] shadow-xs">
            Belum pernah ada sinkronisasi.
          </Card>
        )}
        {runs && runs.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu Mulai</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Naskah Baru</TableHead>
                <TableHead>Catatan / Keterangan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {new Date(run.started_at).toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_CONFIG[run.status]?.variant ?? "default"}>
                      {STATUS_CONFIG[run.status]?.label ?? run.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-[#0B254B]">
                    {run.new_documents_found} naskah
                  </TableCell>
                  <TableCell className="text-[#64748B] text-xs">
                    {run.error_message ?? "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDetail(run.id)}
                      className="h-8 gap-1.5 text-xs font-semibold text-[#123B72] hover:bg-[#EEF4FC] hover:text-[#0B254B]"
                    >
                      <FileText className="h-3.5 w-3.5" /> Detail Naskah
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* MODAL DIALOG: Rincian Naskah & Penulis per Run */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-lg font-bold text-[#0B254B] flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#123B72]" />
              Rincian Naskah Sinkronisasi
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              {modalDetail && (
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span>
                    Dimulai pada:{" "}
                    <strong>
                      {new Date(modalDetail.startedAt).toLocaleString("id-ID")}
                    </strong>
                  </span>
                  <span>· Status:</span>
                  <Badge
                    variant={STATUS_CONFIG[modalDetail.status]?.variant ?? "default"}
                    className="inline-flex py-0 text-[10px]"
                  >
                    {STATUS_CONFIG[modalDetail.status]?.label ?? modalDetail.status}
                  </Badge>
                  <span>
                    · Berhasil ditambahkan:{" "}
                    <strong className="text-emerald-700">
                      {modalDetail.newDocumentsFound} naskah
                    </strong>
                  </span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {modalLoading && (
            <div className="flex flex-col items-center justify-center p-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#123B72]" />
              <p className="text-sm font-semibold text-stone-600">
                Memuat rincian naskah dan penulis...
              </p>
            </div>
          )}

          {!modalLoading && modalDetail && (
            <div className="flex flex-col gap-3.5 min-h-0 flex-1 overflow-hidden">
              {/* Toolbar Pencarian & Filter Status */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6ECF5] pb-3">
                <div className="relative min-w-[240px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                  <Input
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    placeholder="Cari judul naskah atau nama penulis..."
                    className="h-8.5 pl-8.5 text-xs bg-[#F6F9FD]"
                  />
                </div>

                <div className="flex items-center gap-1 rounded-full border border-[#D9E1EC] bg-[#F6F9FD] p-0.5 text-xs">
                  {[
                    { id: "all", label: `Semua (${modalDetail.items.length})` },
                    {
                      id: "created",
                      label: `Baru (${modalDetail.items.filter((i) => i.status === "created").length})`,
                    },
                    {
                      id: "skipped_exists",
                      label: `Dilewati (${modalDetail.items.filter((i) => i.status === "skipped_exists").length})`,
                    },
                    {
                      id: "failed",
                      label: `Gagal (${modalDetail.items.filter((i) => i.status === "failed").length})`,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setModalFilterStatus(tab.id)}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                        modalFilterStatus === tab.id
                          ? "bg-[#123B72] text-white shadow-xs"
                          : "text-stone-600 hover:text-[#0B254B]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tabel Naskah & Penulis (Scrollable) */}
              <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#D9E1EC]">
                {filteredModalItems.length === 0 ? (
                  <div className="p-8 text-center text-sm text-stone-500">
                    Tidak ada naskah yang cocok dengan filter atau pencarian.
                  </div>
                ) : (
                  <Table className="border-0 rounded-none">
                    <TableHeader className="sticky top-0 z-10 bg-[#F6F9FD]">
                      <TableRow>
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>Judul Naskah &amp; Penulis</TableHead>
                        <TableHead className="w-32">Status</TableHead>
                        <TableHead className="w-28 text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredModalItems.map((item, index) => {
                        const authorsStr = (item.authors ?? []).join(", ");
                        const metaParts = [
                          item.volume ? `Vol. ${item.volume}` : null,
                          item.issueNumber ? `No. ${item.issueNumber}` : null,
                          item.publishedYear ? `(${item.publishedYear})` : null,
                          item.doi ? `DOI: ${item.doi}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ");

                        return (
                          <TableRow key={`${item.ojsArticleId}-${index}`}>
                            <TableCell className="text-center text-xs font-medium text-stone-500">
                              {index + 1}
                            </TableCell>
                            <TableCell className="max-w-md">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-[#0B254B] text-xs leading-snug">
                                  {item.title}
                                </span>
                                {authorsStr && (
                                  <span className="text-[11px] text-stone-600 font-medium">
                                    Penulis: {authorsStr}
                                  </span>
                                )}
                                {metaParts && (
                                  <span className="text-[10.5px] text-stone-400">
                                    {metaParts}
                                  </span>
                                )}
                                {item.error && (
                                  <span className="text-[11px] text-rose-600 font-medium">
                                    Error: {item.error}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.status === "created" && (
                                <Badge variant="success" className="text-[10px]">
                                  Baru Ditambahkan
                                </Badge>
                              )}
                              {item.status === "skipped_exists" && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Sudah Ada
                                </Badge>
                              )}
                              {item.status === "skipped_no_pdf" && (
                                <Badge variant="warning" className="text-[10px]">
                                  Tanpa PDF
                                </Badge>
                              )}
                              {item.status === "failed" && (
                                <Badge variant="destructive" className="text-[10px]">
                                  Gagal
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.documentId ? (
                                <Button
                                  asChild
                                  variant="secondary"
                                  size="sm"
                                  className="h-7 px-2.5 text-[11px] font-bold"
                                >
                                  <Link
                                    href={`/documents/${item.documentId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Buka <ChevronRight className="h-3 w-3 ml-0.5" />
                                  </Link>
                                </Button>
                              ) : (
                                <span className="text-[11px] text-stone-400">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 border-t border-[#E6ECF5] pt-3 flex items-center justify-between">
            <span className="text-xs text-stone-500">
              {filteredModalItems.length} naskah ditampilkan
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
              className="text-xs font-semibold"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

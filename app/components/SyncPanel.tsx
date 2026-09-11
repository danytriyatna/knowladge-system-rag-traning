"use client";

import { useEffect, useState } from "react";

interface SyncRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  new_documents_found: number;
  status: "running" | "success" | "partial" | "failed";
  error_message: string | null;
}

interface HarvestResultItem {
  ojsArticleId: string;
  title: string;
  status: "created" | "skipped_exists" | "skipped_no_pdf" | "failed";
  error?: string;
}

interface HarvestOutcome {
  syncRunId: string;
  newDocumentsFound: number;
  status: "success" | "partial" | "failed";
  results: HarvestResultItem[];
}

const STATUS_LABEL: Record<SyncRun["status"], string> = {
  running: "Berjalan",
  success: "Berhasil",
  partial: "Sebagian",
  failed: "Gagal",
};

const STATUS_CLASS: Record<SyncRun["status"], string> = {
  running: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  partial: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

export default function SyncPanel({ onSynced }: { onSynced?: () => void }) {
  const [runs, setRuns] = useState<SyncRun[] | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastOutcome, setLastOutcome] = useState<HarvestOutcome | null>(null);

  async function loadRuns() {
    try {
      const res = await fetch("/api/sync/status");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat status sinkronisasi");
      setRuns(data.runs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat status sinkronisasi");
    }
  }

  useEffect(() => {
    let ignore = false;
    fetch("/api/sync/status")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) setRuns(data.runs ?? []);
      })
      .catch(() => {
        if (!ignore) setError("Gagal memuat status sinkronisasi");
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  async function handleRunSync() {
    setRunning(true);
    setElapsed(0);
    setError(null);
    setLastOutcome(null);
    try {
      const res = await fetch("/api/sync/ojs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data: HarvestOutcome & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sinkronisasi gagal");
      setLastOutcome(data);
      await loadRuns();
      onSynced?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sinkronisasi gagal");
    } finally {
      setRunning(false);
    }
  }

  const created = lastOutcome?.results.filter((r) => r.status === "created").length ?? 0;
  const skipped =
    lastOutcome?.results.filter(
      (r) => r.status === "skipped_exists" || r.status === "skipped_no_pdf"
    ).length ?? 0;
  const failed = lastOutcome?.results.filter((r) => r.status === "failed").length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted">
          Tarik naskah terbit dari arsip resmi Jurnal Permukiman (OAI-PMH) lalu unduh,
          ekstrak, chunk, dan embed otomatis untuk naskah yang belum ada di sistem.
          Naskah yang sudah pernah masuk dilewati (tidak diduplikasi).
        </p>
        <button
          onClick={handleRunSync}
          disabled={running}
          className="press shrink-0 rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {running ? `Sinkronisasi berjalan... (${elapsed}s)` : "Jalankan Sinkronisasi Sekarang"}
        </button>
      </div>

      {running && (
        <p className="fade-in text-xs text-muted">
          Sedang menarik metadata &amp; PDF dari jurnalpermukiman.pu.go.id. Untuk seluruh
          arsip ini bisa memakan waktu beberapa menit karena tiap naskah baru diproses
          lengkap (ekstraksi, chunk, embedding). Jangan tutup halaman ini.
        </p>
      )}

      {error && <p className="fade-in text-sm text-red-600 dark:text-red-400">{error}</p>}

      {lastOutcome && (
        <div className="fade-in rounded-xl border border-border bg-surface p-4 text-sm">
          <p className="mb-2 font-medium text-foreground">
            Sinkronisasi selesai: {STATUS_LABEL[lastOutcome.status]}
          </p>
          <p className="text-muted">
            {created} naskah baru ditambahkan &middot; {skipped} dilewati (sudah ada /
            tanpa PDF) &middot; {failed} gagal diproses
          </p>
          {failed > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-xs text-red-600 dark:text-red-400">
              {lastOutcome.results
                .filter((r) => r.status === "failed")
                .map((r) => (
                  <li key={r.ojsArticleId}>
                    {r.title}: {r.error}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-muted">Riwayat Sinkronisasi</h3>
        {runs === null && <p className="text-sm text-muted">Memuat...</p>}
        {runs && runs.length === 0 && (
          <p className="text-sm text-muted">Belum pernah ada sinkronisasi.</p>
        )}
        {runs && runs.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Waktu Mulai</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Naskah Baru</th>
                  <th className="px-3 py-2 font-medium">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-2 text-foreground">
                      {new Date(run.started_at).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[run.status]}`}
                      >
                        {STATUS_LABEL[run.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-foreground">{run.new_documents_found}</td>
                    <td className="px-3 py-2 text-muted">{run.error_message ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

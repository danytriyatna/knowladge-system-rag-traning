"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ExtractionMethod = "local" | "gemini";
type DocumentSource = "ojs_harvest" | "manual_upload";
type ViewTab = "text" | "pdf" | "chunks" | "embeddings";

interface DocumentDetail {
  id: string;
  filename: string;
  extracted_text: string;
  extraction_method: ExtractionMethod;
  page_count: number;
  uploaded_at: string;
  title: string;
  authors: string;
  doi: string;
  published_year: number | null;
  source: DocumentSource;
}

interface ChunkItem {
  id: string;
  chunk_index: number;
  content: string;
  char_count: number;
}

interface EmbeddingItem {
  id: string;
  chunk_id: string;
  chunk_index: number;
  model: string;
  dimensions: number;
  preview: number[];
  created_at: string;
}

interface EmbeddingDetail {
  id: string;
  chunk_id: string;
  chunk_index: number;
  chunk_content: string;
  model: string;
  dimensions: number;
  vector: number[];
  created_at: string;
}

const METHOD_LABEL: Record<ExtractionMethod, string> = {
  local: "Lokal",
  gemini: "Gemini",
};

const SOURCE_LABEL: Record<DocumentSource, string> = {
  ojs_harvest: "Jurnal",
  manual_upload: "Manual",
};

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ViewTab>("text");
  const [isAdmin, setIsAdmin] = useState(false);

  const [chunks, setChunks] = useState<ChunkItem[] | null>(null);
  const [chunkLoading, setChunkLoading] = useState(false);
  const [chunkCreating, setChunkCreating] = useState(false);
  const [chunkError, setChunkError] = useState<string | null>(null);

  const [embeddings, setEmbeddings] = useState<EmbeddingItem[] | null>(null);
  const [embeddingLoading, setEmbeddingLoading] = useState(false);
  const [embeddingCreating, setEmbeddingCreating] = useState(false);
  const [embeddingError, setEmbeddingError] = useState<string | null>(null);
  const [embeddingElapsed, setEmbeddingElapsed] = useState(0);
  const [expandedEmbeddingId, setExpandedEmbeddingId] = useState<string | null>(null);
  const [embeddingDetails, setEmbeddingDetails] = useState<Record<string, EmbeddingDetail>>({});
  const [embeddingDetailLoadingId, setEmbeddingDetailLoadingId] = useState<string | null>(null);
  const [embeddingDetailError, setEmbeddingDetailError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/documents/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Gagal memuat dokumen");
        setDocument(data.document);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat dokumen"));
  }, [id]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setIsAdmin(data.user?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    if (!embeddingCreating) return;
    const interval = setInterval(() => {
      setEmbeddingElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [embeddingCreating]);

  async function handleDelete() {
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    router.push("/");
  }

  async function loadChunks() {
    setChunkLoading(true);
    setChunkError(null);
    try {
      const res = await fetch(`/api/documents/${id}/chunks`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat chunk");
      setChunks(data.chunks ?? []);
    } catch (err) {
      setChunkError(err instanceof Error ? err.message : "Gagal memuat chunk");
    } finally {
      setChunkLoading(false);
    }
  }

  function handleViewChunks() {
    setTab("chunks");
    if (chunks === null) loadChunks();
  }

  async function handleCreateChunks() {
    setChunkCreating(true);
    setChunkError(null);
    try {
      const res = await fetch(`/api/documents/${id}/chunks`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat chunk");
      setChunks(data.chunks ?? []);
      setTab("chunks");
      setEmbeddings(null);
    } catch (err) {
      setChunkError(err instanceof Error ? err.message : "Gagal membuat chunk");
    } finally {
      setChunkCreating(false);
    }
  }

  async function loadEmbeddings() {
    setEmbeddingLoading(true);
    setEmbeddingError(null);
    try {
      const res = await fetch(`/api/documents/${id}/embeddings`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat embedding");
      setEmbeddings(data.embeddings ?? []);
    } catch (err) {
      setEmbeddingError(err instanceof Error ? err.message : "Gagal memuat embedding");
    } finally {
      setEmbeddingLoading(false);
    }
  }

  function handleViewEmbeddings() {
    setTab("embeddings");
    if (embeddings === null) loadEmbeddings();
  }

  async function handleCreateEmbeddings() {
    setEmbeddingCreating(true);
    setEmbeddingElapsed(0);
    setEmbeddingError(null);
    try {
      const res = await fetch(`/api/documents/${id}/embeddings`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat embedding");
      setEmbeddings(data.embeddings ?? []);
      setTab("embeddings");
    } catch (err) {
      setEmbeddingError(err instanceof Error ? err.message : "Gagal membuat embedding");
    } finally {
      setEmbeddingCreating(false);
    }
  }

  async function handleToggleEmbedding(embeddingId: string) {
    if (expandedEmbeddingId === embeddingId) {
      setExpandedEmbeddingId(null);
      return;
    }
    setExpandedEmbeddingId(embeddingId);
    if (embeddingDetails[embeddingId]) return;

    setEmbeddingDetailLoadingId(embeddingId);
    setEmbeddingDetailError(null);
    try {
      const res = await fetch(`/api/documents/${id}/embeddings/${embeddingId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat detail embedding");
      setEmbeddingDetails((prev) => ({ ...prev, [embeddingId]: data.embedding }));
    } catch (err) {
      setEmbeddingDetailError(
        err instanceof Error ? err.message : "Gagal memuat detail embedding"
      );
    } finally {
      setEmbeddingDetailLoadingId(null);
    }
  }

  const fileUrl = `/api/documents/${id}/file`;
  const authors: string[] = (() => {
    try {
      return JSON.parse(document?.authors || "[]");
    } catch {
      return [];
    }
  })();

  return (
    <div className="flex min-h-screen flex-col puskim-canvas text-foreground">
      <header className="sticky top-0 z-20 border-b border-[#8C2806]/60 bg-gradient-to-r from-[#B93A0C] via-[#C13D0D] to-[#962D08] shadow-sm">
        <div className="mx-auto flex w-full max-w-[1520px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 rounded-lg transition-opacity hover:opacity-90">
            <div className="flex h-9 items-center rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-black/10 shrink-0">
              <Image
                src="/kemenpu_pill_clean.png"
                alt="Kementerian Pekerjaan Umum"
                width={136}
                height={32}
                className="h-7 w-auto object-contain"
                priority
              />
            </div>
            <div className="leading-tight">
              <p className="text-base font-extrabold tracking-tight text-white uppercase">JP-Insight</p>
              <p className="text-[11px] font-medium tracking-wide text-white/85">Jurnal Permukiman</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#DFD9D2] bg-white px-3 py-1.5 text-xs font-semibold text-[#A0320A] shadow-xs transition-colors hover:border-[#F4D4C9] hover:bg-[#FDF4F0]"
          >
            &larr; Kembali ke Basis Pengetahuan
          </Link>
        </div>

        {error && <p className="fade-in text-sm text-rose-600">{error}</p>}

        {document && (
          <>
            <div className="fresh-card flex flex-wrap items-start justify-between gap-4 rounded-2xl border-t-[3px] border-t-[#C13D0D] p-5">
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-stone-900">
                  {document.title || document.filename}
                </h1>
                {authors.length > 0 && (
                  <p className="mt-1 text-sm text-stone-600">
                    {authors.join(", ")}
                    {document.published_year ? ` · ${document.published_year}` : ""}
                  </p>
                )}
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                  <span className="rounded-full border border-[#F4D4C9] bg-[#FDF4F0] px-2.5 py-0.5 font-semibold text-[#A0320A]">
                    {SOURCE_LABEL[document.source] ?? "Manual"}
                  </span>
                  <span className="rounded-full border border-[#DFD9D2] bg-[#FAF8F5] px-2.5 py-0.5 font-medium text-stone-700">
                    {METHOD_LABEL[document.extraction_method]}
                  </span>
                  <span>{document.page_count} halaman</span>
                  <span>&middot;</span>
                  <span>{new Date(document.uploaded_at).toLocaleString("id-ID")}</span>
                  {document.doi && <span className="font-mono text-stone-600">DOI: {document.doi}</span>}
                </p>
              </div>
              {isAdmin && (
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  onClick={handleCreateChunks}
                  disabled={chunkCreating}
                  className="press rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-50"
                >
                  {chunkCreating ? "Membuat Chunk..." : "Buat Chunk"}
                </button>
                <button
                  onClick={handleViewChunks}
                  className="press rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
                >
                  Lihat Chunk
                </button>
                <button
                  onClick={handleCreateEmbeddings}
                  disabled={embeddingCreating}
                  className="press rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-50"
                >
                  {embeddingCreating
                    ? `Membuat Embedding... (${embeddingElapsed}s)`
                    : embeddings && embeddings.length > 0
                      ? "Buat Ulang Embedding"
                      : "Buat Embedding"}
                </button>
                <button
                  onClick={handleViewEmbeddings}
                  className="press rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
                >
                  Lihat Embedding
                </button>
                <button
                  onClick={handleDelete}
                  className="press rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Hapus
                </button>
              </div>
              )}
            </div>

            <div className="flex items-center justify-between border-b border-border">
              <div className="flex gap-1 overflow-x-auto">
                <button
                  onClick={() => setTab("text")}
                  className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors ${
                    tab === "text"
                      ? "border-b-2 border-accent text-accent-text"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  Teks Narasi
                </button>
                <button
                  onClick={() => setTab("pdf")}
                  className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors ${
                    tab === "pdf"
                      ? "border-b-2 border-accent text-accent-text"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  PDF Asli
                </button>
                {isAdmin && (
                <button
                  onClick={handleViewChunks}
                  className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors ${
                    tab === "chunks"
                      ? "border-b-2 border-accent text-accent-text"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  Chunks{chunks ? ` (${chunks.length})` : ""}
                </button>
                )}
                {isAdmin && (
                <button
                  onClick={handleViewEmbeddings}
                  className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors ${
                    tab === "embeddings"
                      ? "border-b-2 border-accent text-accent-text"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  Embedding{embeddings ? ` (${embeddings.length})` : ""}
                </button>
                )}
              </div>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 pb-2 pl-2 text-xs text-muted hover:underline"
              >
                Buka di tab baru &#8599;
              </a>
            </div>

            {tab === "text" && (
              <pre className="whitespace-pre-wrap rounded-xl border border-border bg-surface p-4 text-sm leading-6">
                {document.extracted_text || "(Tidak ada teks yang bisa diekstrak dari PDF ini)"}
              </pre>
            )}

            {tab === "pdf" && (
              <iframe
                src={fileUrl}
                title={document.filename}
                className="h-[80vh] w-full rounded-xl border border-border"
              />
            )}

            {tab === "chunks" && (
              <div className="flex flex-col gap-3">
                {chunkError && (
                  <p className="fade-in text-sm text-red-600 dark:text-red-400">{chunkError}</p>
                )}
                {chunkLoading && <p className="text-sm text-muted">Memuat chunk...</p>}
                {!chunkLoading && chunks && chunks.length === 0 && (
                  <p className="text-sm text-muted">
                    Belum ada chunk untuk dokumen ini. Klik &quot;Buat Chunk&quot; di atas
                    untuk memprosesnya.
                  </p>
                )}
                {!chunkLoading &&
                  chunks &&
                  chunks.map((chunk) => (
                    <div key={chunk.id} className="rounded-xl border border-border bg-surface p-4">
                      <div className="mb-2 flex items-center justify-between text-xs text-muted">
                        <span>Chunk #{chunk.chunk_index + 1}</span>
                        <span>{chunk.char_count} karakter</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6">{chunk.content}</p>
                    </div>
                  ))}
              </div>
            )}

            {tab === "embeddings" && (
              <div className="flex flex-col gap-3">
                {embeddingError && (
                  <p className="fade-in text-sm text-red-600 dark:text-red-400">{embeddingError}</p>
                )}
                {embeddingLoading && <p className="text-sm text-muted">Memuat embedding...</p>}
                {!embeddingLoading && embeddings && embeddings.length === 0 && (
                  <p className="text-sm text-muted">
                    Belum ada embedding untuk dokumen ini. Pastikan chunk sudah dibuat,
                    lalu klik &quot;Buat Embedding&quot; di atas.
                  </p>
                )}
                {!embeddingLoading && embeddings && embeddings.length > 0 && (
                  <p className="text-xs text-muted">
                    Model: {embeddings[0].model} &middot; Dimensi: {embeddings[0].dimensions}
                  </p>
                )}
                {!embeddingLoading &&
                  embeddings &&
                  embeddings.map((embedding) => {
                    const isExpanded = expandedEmbeddingId === embedding.id;
                    const detail = embeddingDetails[embedding.id];
                    const isDetailLoading = embeddingDetailLoadingId === embedding.id;
                    return (
                      <div key={embedding.id} className="rounded-xl border border-border bg-surface">
                        <button
                          onClick={() => handleToggleEmbedding(embedding.id)}
                          className="flex w-full flex-col gap-2 p-4 text-left"
                        >
                          <div className="flex items-center justify-between text-xs text-muted">
                            <span className="flex items-center gap-2">
                              <span
                                className={`inline-block transition-transform ${isExpanded ? "rotate-90" : ""}`}
                              >
                                &#9656;
                              </span>
                              Chunk #{embedding.chunk_index + 1}
                            </span>
                            <span>{new Date(embedding.created_at).toLocaleString("id-ID")}</span>
                          </div>
                          <p className="truncate font-mono text-xs text-muted">
                            [{embedding.preview.map((v) => v.toFixed(4)).join(", ")}, ...]
                          </p>
                        </button>

                        {isExpanded && (
                          <div className="fade-in flex flex-col gap-3 border-t border-border p-4">
                            {isDetailLoading && (
                              <p className="text-sm text-muted">Memuat detail...</p>
                            )}
                            {!isDetailLoading && embeddingDetailError && (
                              <p className="fade-in text-sm text-red-600 dark:text-red-400">
                                {embeddingDetailError}
                              </p>
                            )}
                            {!isDetailLoading && detail && (
                              <>
                                <div>
                                  <h3 className="mb-1 text-xs font-medium text-muted">
                                    Teks chunk sumber
                                  </h3>
                                  <p className="whitespace-pre-wrap rounded-md bg-background p-3 text-sm leading-6">
                                    {detail.chunk_content}
                                  </p>
                                </div>
                                <div>
                                  <h3 className="mb-1 text-xs font-medium text-muted">
                                    Vector lengkap ({detail.dimensions} dimensi, model{" "}
                                    {detail.model})
                                  </h3>
                                  <p className="max-h-56 overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-background p-3 font-mono text-xs text-muted">
                                    [{detail.vector.map((v) => v.toFixed(6)).join(", ")}]
                                  </p>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

"use client";

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
    <div className="flex min-h-screen flex-col items-center bg-background text-foreground">
      <main className="flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
        <Link href="/" className="text-sm text-muted hover:underline">
          &larr; Kembali
        </Link>

        {error && <p className="fade-in text-sm text-red-600 dark:text-red-400">{error}</p>}

        {document && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight">
                  {document.title || document.filename}
                </h1>
                {authors.length > 0 && (
                  <p className="mt-0.5 text-sm text-muted">
                    {authors.join(", ")}
                    {document.published_year ? ` · ${document.published_year}` : ""}
                  </p>
                )}
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                    {SOURCE_LABEL[document.source] ?? "Manual"}
                  </span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                    {METHOD_LABEL[document.extraction_method]}
                  </span>
                  {document.page_count} halaman &middot;{" "}
                  {new Date(document.uploaded_at).toLocaleString("id-ID")}
                  {document.doi && <span className="font-mono text-xs">DOI: {document.doi}</span>}
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

"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  FileText,
  Layers,
  Cpu,
  Trash2,
  ExternalLink,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  FileDown,
} from "lucide-react";

type ExtractionMethod = "local" | "gemini";
type DocumentSource = "ojs_harvest" | "ojs_portal" | "jp_insight_info" | "manual_upload";
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
  source_url?: string | null;
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
  ojs_portal: "Portal OJS",
  jp_insight_info: "JP-Insight",
  manual_upload: "Manual",
};

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ViewTab>("text");

  const [chunks, setChunks] = useState<ChunkItem[] | null>(null);
  const [chunkLoading, setChunkLoading] = useState(false);
  const [chunkCreating, setChunkCreating] = useState(false);
  const [chunkError, setChunkError] = useState<string | null>(null);

  const [embeddings, setEmbeddings] = useState<EmbeddingItem[] | null>(null);
  const [embeddingLoading, setEmbeddingLoading] = useState(false);
  const [embeddingCreating, setEmbeddingCreating] = useState(false);
  const [embeddingElapsed, setEmbeddingElapsed] = useState(0);
  const [embeddingError, setEmbeddingError] = useState<string | null>(null);

  const [expandedEmbeddingId, setExpandedEmbeddingId] = useState<string | null>(null);
  const [embeddingDetails, setEmbeddingDetails] = useState<Record<string, EmbeddingDetail>>({});
  const [embeddingDetailLoadingId, setEmbeddingDetailLoadingId] = useState<string | null>(null);
  const [embeddingDetailError, setEmbeddingDetailError] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role === "admin") setIsAdmin(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    let ignore = false;
    fetch(`/api/documents/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Gagal memuat dokumen");
        return res.json();
      })
      .then((data) => {
        if (!ignore) setDocument(data.document);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      });
    return () => {
      ignore = true;
    };
  }, [id]);

  useEffect(() => {
    if (!embeddingCreating) return;
    const interval = setInterval(() => setEmbeddingElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [embeddingCreating]);

  async function handleViewChunks() {
    setTab("chunks");
    if (chunks) return;
    setChunkLoading(true);
    setChunkError(null);
    try {
      const res = await fetch(`/api/documents/${id}/chunks`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat chunk");
      setChunks(data.chunks);
    } catch (err) {
      setChunkError(err instanceof Error ? err.message : "Gagal memuat chunk");
    } finally {
      setChunkLoading(false);
    }
  }

  async function handleCreateChunks() {
    setChunkCreating(true);
    setChunkError(null);
    try {
      const res = await fetch(`/api/documents/${id}/chunks`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat chunk");
      setChunks(data.chunks);
      setTab("chunks");
    } catch (err) {
      setChunkError(err instanceof Error ? err.message : "Gagal membuat chunk");
    } finally {
      setChunkCreating(false);
    }
  }

  async function handleViewEmbeddings() {
    setTab("embeddings");
    if (embeddings) return;
    setEmbeddingLoading(true);
    setEmbeddingError(null);
    try {
      const res = await fetch(`/api/documents/${id}/embeddings`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat embedding");
      setEmbeddings(data.embeddings);
    } catch (err) {
      setEmbeddingError(err instanceof Error ? err.message : "Gagal memuat embedding");
    } finally {
      setEmbeddingLoading(false);
    }
  }

  async function handleCreateEmbeddings() {
    setEmbeddingCreating(true);
    setEmbeddingElapsed(0);
    setEmbeddingError(null);
    try {
      const res = await fetch(`/api/documents/${id}/embeddings`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat embedding");
      setEmbeddings(data.embeddings);
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
      setEmbeddingDetailError(err instanceof Error ? err.message : "Gagal memuat detail embedding");
    } finally {
      setEmbeddingDetailLoadingId(null);
    }
  }

  async function handleDelete() {
    if (!confirm("Hapus dokumen ini beserta seluruh teks, chunk, dan embedding-nya?")) return;
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/");
    } catch {
      setError("Gagal menghapus dokumen");
    }
  }

  const authors: string[] = (() => {
    try {
      return JSON.parse(document?.authors || "[]");
    } catch {
      return [];
    }
  })();

  const fileUrl = `/api/documents/${id}/file`;

  return (
    <div className="flex min-h-screen w-full flex-col puskim-canvas text-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b-2 border-[#EAB308]/85 bg-gradient-to-r from-[#0B2347] via-[#123B72] to-[#081A36] shadow-sm">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
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
              <p className="text-[11px] font-medium tracking-wide text-[#FDE68A]">Rincian Naskah Ilmiah</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl text-xs font-bold shadow-2xs">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Daftar Dokumen
            </Link>
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {document && (
          <div className="flex flex-col gap-6">
            <Card className="border-t-4 border-t-[#123B72]">
              <CardContent className="flex flex-wrap items-start justify-between gap-6 p-6">
                <div className="min-w-0 max-w-3xl">
                  <h1 className="font-serif text-xl sm:text-2xl font-bold leading-[1.35] tracking-tight text-[#0B254B]">
                    {document.title || document.filename}
                  </h1>
                  {authors.length > 0 && (
                    <p className="mt-2 text-sm text-[#475569] font-medium">
                      {authors.join(", ")}
                      {document.published_year ? ` · ${document.published_year}` : ""}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                    <Badge variant="secondary">
                      {SOURCE_LABEL[document.source] ?? "Manual"}
                    </Badge>
                    <Badge variant="outline">
                      {METHOD_LABEL[document.extraction_method]}
                    </Badge>
                    <span>{document.page_count} halaman</span>
                    <span>&bull;</span>
                    <span>{new Date(document.uploaded_at).toLocaleString("id-ID")}</span>
                    {document.doi && (
                      <span className="font-mono text-xs text-[#0B254B]">
                        DOI: {document.doi}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {document.source_url && (
                    <Button variant="outline" size="sm" asChild className="gap-1.5 rounded-xl text-xs">
                      <a href={document.source_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Halaman Sumber
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" asChild className="gap-1.5 rounded-xl text-xs">
                    <a href={fileUrl} download>
                      <FileDown className="h-4 w-4" />
                      Unduh PDF
                    </a>
                  </Button>
                  {isAdmin && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleCreateChunks}
                        disabled={chunkCreating}
                        className="gap-1.5 rounded-xl text-xs"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        {chunkCreating ? "Membuat Chunk..." : "Buat Chunk"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleCreateEmbeddings}
                        disabled={embeddingCreating}
                        className="gap-1.5 rounded-xl text-xs"
                      >
                        <Cpu className={`h-3.5 w-3.5 ${embeddingCreating ? "animate-spin" : ""}`} />
                        {embeddingCreating
                          ? `Membuat Embedding... (${embeddingElapsed}d)`
                          : embeddings && embeddings.length > 0
                          ? "Buat Ulang Embedding"
                          : "Buat Embedding"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleDelete}
                        className="gap-1.5 rounded-xl text-xs"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Tabs value={tab} onValueChange={(val) => setTab(val as ViewTab)} className="w-full">
              <div className="flex items-center justify-between border-b border-[#D9E1EC] pb-2">
                <TabsList className="bg-[#EEF4FC] p-1 rounded-xl">
                  <TabsTrigger value="text" className="gap-1.5 text-xs font-semibold">
                    <FileText className="h-3.5 w-3.5" />
                    Teks Narasi
                  </TabsTrigger>
                  <TabsTrigger value="pdf" className="gap-1.5 text-xs font-semibold">
                    <ExternalLink className="h-3.5 w-3.5" />
                    PDF Asli
                  </TabsTrigger>
                  {isAdmin && (
                    <TabsTrigger value="chunks" onClick={handleViewChunks} className="gap-1.5 text-xs font-semibold">
                      <Layers className="h-3.5 w-3.5" />
                      Chunks {chunks ? `(${chunks.length})` : ""}
                    </TabsTrigger>
                  )}
                  {isAdmin && (
                    <TabsTrigger value="embeddings" onClick={handleViewEmbeddings} className="gap-1.5 text-xs font-semibold">
                      <Cpu className="h-3.5 w-3.5" />
                      Embedding {embeddings ? `(${embeddings.length})` : ""}
                    </TabsTrigger>
                  )}
                </TabsList>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#123B72] hover:underline"
                >
                  <span>Buka di tab baru</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <TabsContent value="text" className="mt-4">
                <Card>
                  <CardContent className="p-6">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#1C1917]">
                      {document.extracted_text || "(Tidak ada teks yang bisa diekstrak dari PDF ini)"}
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pdf" className="mt-4">
                <Card className="overflow-hidden p-0">
                  <iframe
                    src={fileUrl}
                    title={document.filename}
                    className="h-[80vh] w-full border-0"
                  />
                </Card>
              </TabsContent>

              <TabsContent value="chunks" className="mt-4 flex flex-col gap-3">
                {chunkError && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{chunkError}</span>
                  </div>
                )}
                {chunkLoading && <p className="text-sm text-[#64748B]">Memuat data chunk...</p>}
                {!chunkLoading && chunks && chunks.length === 0 && (
                  <Card className="p-8 text-center text-sm text-[#64748B]">
                    Belum ada chunk untuk dokumen ini. Klik tombol &ldquo;Buat Chunk&rdquo; di atas.
                  </Card>
                )}
                {!chunkLoading &&
                  chunks &&
                  chunks.map((chunk) => (
                    <Card key={chunk.id} className="p-5">
                      <div className="mb-2 flex items-center justify-between text-xs text-[#64748B]">
                        <span className="font-bold text-[#123B72]">Chunk #{chunk.chunk_index + 1}</span>
                        <span>{chunk.char_count} karakter</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1C1917]">{chunk.content}</p>
                    </Card>
                  ))}
              </TabsContent>

              <TabsContent value="embeddings" className="mt-4 flex flex-col gap-3">
                {embeddingError && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{embeddingError}</span>
                  </div>
                )}
                {embeddingLoading && <p className="text-sm text-[#64748B]">Memuat embedding...</p>}
                {!embeddingLoading && embeddings && embeddings.length === 0 && (
                  <Card className="p-8 text-center text-sm text-[#64748B]">
                    Belum ada embedding untuk dokumen ini. Pastikan chunk sudah dibuat lalu klik &ldquo;Buat Embedding&rdquo;.
                  </Card>
                )}
                {!embeddingLoading && embeddings && embeddings.length > 0 && (
                  <p className="text-xs font-semibold text-[#0B254B]">
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
                      <Card key={embedding.id} className="overflow-hidden">
                        <button
                          onClick={() => handleToggleEmbedding(embedding.id)}
                          className="flex w-full flex-col gap-2 p-4 text-left hover:bg-[#EEF4FC]/40 cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-xs text-[#64748B]">
                            <span className="flex items-center gap-2 font-bold text-[#0B254B]">
                              <ChevronRight className={`h-4 w-4 text-[#123B72] transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              Chunk #{embedding.chunk_index + 1}
                            </span>
                            <span>{new Date(embedding.created_at).toLocaleString("id-ID")}</span>
                          </div>
                          <p className="truncate font-mono text-xs text-[#64748B]">
                            [{embedding.preview.map((v) => v.toFixed(4)).join(", ")}, ...]
                          </p>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-[#D9E1EC] bg-[#F8FAFD] p-5 flex flex-col gap-3 animate-in fade-in-50">
                            {isDetailLoading && <p className="text-sm text-[#64748B]">Memuat detail...</p>}
                            {!isDetailLoading && detail && (
                              <>
                                <div>
                                  <h4 className="text-xs font-bold text-[#0B254B] mb-1">Teks Chunk Sumber:</h4>
                                  <p className="whitespace-pre-wrap rounded-xl bg-white p-3 text-xs leading-relaxed border border-[#D9E1EC]">
                                    {detail.chunk_content}
                                  </p>
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-[#0B254B] mb-1">
                                    Vector Lengkap ({detail.dimensions} dimensi, {detail.model}):
                                  </h4>
                                  <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-all rounded-xl bg-white p-3 font-mono text-[11px] text-[#64748B] border border-[#D9E1EC]">
                                    [{detail.vector.map((v) => v.toFixed(6)).join(", ")}]
                                  </p>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  })}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}

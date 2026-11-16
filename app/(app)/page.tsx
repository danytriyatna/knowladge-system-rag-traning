"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import SkillsPanel from "@/app/components/SkillsPanel";
import SyncPanel from "@/app/components/SyncPanel";
import AdminPanel from "@/app/components/AdminPanel";
import RegulationsPanel from "@/app/components/RegulationsPanel";
import GapPanel from "@/app/components/GapPanel";
import ChatPanel from "@/app/components/ChatPanel";
import ChatWidget from "@/app/components/ChatWidget";
import AccountMenu from "@/app/components/AccountMenu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  FileText,
  MessageSquare,
  BookOpen,
  Sparkles,
  Zap,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  Search,
  X,
  Send,
  Plus,
  Trash2,
  ExternalLink,
  ChevronRight,
  Loader2,
  Copy,
  Check,
} from "lucide-react";

type ExtractionMethod = "local" | "gemini";
type DocumentSource = "ojs_harvest" | "manual_upload";
type PageTab = "documents" | "chat" | "regulations" | "gaps" | "skills" | "sync" | "admin";
type UserRole = "admin" | "unit_user";

interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  unit: string | null;
}

interface DocumentSummary {
  id: string;
  filename: string;
  extraction_method: ExtractionMethod;
  page_count: number;
  uploaded_at: string;
  title: string;
  authors: string;
  doi: string;
  published_year: number | null;
  volume: string;
  issue_number: string;
  topics: string;
  source: DocumentSource;
}

const SOURCE_LABEL: Record<DocumentSource, string> = {
  ojs_harvest: "Jurnal",
  manual_upload: "Manual",
};

type QueryMode = "chat" | "kajian";
type EvidenceStrength = "kuat" | "sedang" | "lemah";

interface ChatSource {
  document_id: string;
  filename: string;
  chunk_index: number;
  similarity: number;
  title?: string;
  authors?: string;
  published_year?: number | null;
  volume?: string | null;
  issue_number?: string | null;
  doi?: string | null;
  article_url?: string | null;
  snippet?: string;
}

interface KajianPoint {
  claim: string;
  sources: ChatSource[];
  needsVerification: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  timestamp: string;
  queryMode?: QueryMode;
  evidenceStrength?: EvidenceStrength | null;
  points?: KajianPoint[] | null;
}

interface ChatHistoryItem {
  id: string;
  question: string;
  created_at: string;
  mode: QueryMode;
  evidence_strength: EvidenceStrength | null;
}

const EVIDENCE_LABEL: Record<EvidenceStrength, string> = {
  kuat: "Kuat",
  sedang: "Sedang",
  lemah: "Lemah",
};

const EVIDENCE_CLASS: Record<EvidenceStrength, string> = {
  kuat: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  sedang: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  lemah: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

const METHOD_LABEL: Record<ExtractionMethod, string> = {
  local: "Lokal",
  gemini: "Gemini",
};

interface NavItem {
  tab: PageTab;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    tab: "documents",
    label: "Dokumen",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    tab: "chat",
    label: "Chat & Kajian",
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    tab: "regulations",
    label: "Peraturan Dirujuk",
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    tab: "gaps",
    label: "Celah Riset",
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    tab: "skills",
    label: "Skill",
    adminOnly: true,
    icon: <Zap className="h-4 w-4" />,
  },
  {
    tab: "sync",
    label: "Sinkronisasi OJS",
    adminOnly: true,
    icon: <RefreshCw className="h-4 w-4" />,
  },
  {
    tab: "admin",
    label: "Admin",
    adminOnly: true,
    icon: <ShieldCheck className="h-4 w-4" />,
  },
];

export default function Home() {
  const router = useRouter();
  const [pageTab, setPageTab] = useState<PageTab>("documents");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [docSearch, setDocSearch] = useState("");
  const [docSourceFilter, setDocSourceFilter] = useState<"all" | DocumentSource>("all");
  const [docFilterYear, setDocFilterYear] = useState<number | null>(null);
  const [docFilterTopics, setDocFilterTopics] = useState<string[]>([]);
  const [docTopicInput, setDocTopicInput] = useState("");
  const [docPage, setDocPage] = useState(1);
  const [docPageSize, setDocPageSize] = useState(10);
  const [mode, setMode] = useState<ExtractionMethod>("local");
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    let ignore = false;
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (ignore) return;
        const sessionUser = data?.user;
        if (!sessionUser) {
          setCurrentUser(null);
          return;
        }
        setCurrentUser({
          id: sessionUser.id,
          email: sessionUser.email ?? "",
          fullName: sessionUser.fullName ?? sessionUser.name ?? "",
          role: sessionUser.role,
          unit: sessionUser.unit ?? null,
        });
      })
      .catch(() => {
        if (!ignore) setCurrentUser(null);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const isAdmin = currentUser?.role === "admin";
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  async function handleLogout() {
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  async function loadDocuments() {
    const res = await fetch("/api/documents");
    const data = await res.json();
    setDocuments(data.documents ?? []);
  }

  useEffect(() => {
    let ignore = false;
    fetch("/api/documents")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) setDocuments(data.documents ?? []);
      });
    return () => {
      ignore = true;
    };
  }, []);


  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatAuthors(authorsStr?: string | null): string {
    if (!authorsStr) return "";
    try {
      const parsed = JSON.parse(authorsStr);
      if (Array.isArray(parsed)) return parsed.join(", ");
      return String(parsed);
    } catch {
      return authorsStr.replace(/[\[\]"']/g, "").trim();
    }
  }

  const filteredDocuments = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    return documents.filter((doc) => {
      if (docSourceFilter !== "all" && doc.source !== docSourceFilter) return false;
      if (docFilterYear && doc.published_year !== docFilterYear) return false;
      if (docFilterTopics.length > 0) {
        const docTopics: string[] = (() => {
          try {
            return JSON.parse(doc.topics || "[]");
          } catch {
            return [];
          }
        })();
        const lowerDocTopics = docTopics.map((t) => t.toLowerCase());
        const hasAnyTopic = docFilterTopics.some((t) => lowerDocTopics.includes(t.toLowerCase()));
        if (!hasAnyTopic) return false;
      }
      if (!q) return true;
      const authors: string[] = (() => {
        try {
          return JSON.parse(doc.authors || "[]");
        } catch {
          return [];
        }
      })();
      const haystack = `${doc.title} ${doc.filename} ${authors.join(" ")} ${doc.doi}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [documents, docSearch, docSourceFilter, docFilterYear, docFilterTopics]);

  // Reset pagination to page 1 whenever search, filters, or page size change
  useEffect(() => {
    setDocPage(1);
  }, [docSearch, docSourceFilter, docFilterYear, docFilterTopics, docPageSize]);

  const totalDocPages = Math.max(1, Math.ceil(filteredDocuments.length / docPageSize));

  useEffect(() => {
    if (docPage > totalDocPages) {
      setDocPage(totalDocPages);
    }
  }, [docPage, totalDocPages]);

  const paginatedDocuments = useMemo(() => {
    const start = (docPage - 1) * docPageSize;
    return filteredDocuments.slice(start, start + docPageSize);
  }, [filteredDocuments, docPage, docPageSize]);

  const startDocIndex = filteredDocuments.length === 0 ? 0 : (docPage - 1) * docPageSize + 1;
  const endDocIndex = Math.min(docPage * docPageSize, filteredDocuments.length);

  const docPaginationItems = useMemo(() => {
    if (totalDocPages <= 7) {
      return Array.from({ length: totalDocPages }, (_, i) => i + 1);
    }
    if (docPage <= 4) {
      return [1, 2, 3, 4, 5, "ellipsis-end", totalDocPages];
    }
    if (docPage >= totalDocPages - 3) {
      return [
        1,
        "ellipsis-start",
        totalDocPages - 4,
        totalDocPages - 3,
        totalDocPages - 2,
        totalDocPages - 1,
        totalDocPages,
      ];
    }
    return [1, "ellipsis-start", docPage - 1, docPage, docPage + 1, "ellipsis-end", totalDocPages];
  }, [docPage, totalDocPages]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    documents.forEach((doc) => {
      if (doc.published_year) years.add(doc.published_year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [documents]);

  const availableTopics = useMemo(() => {
    const topics = new Set<string>();
    documents.forEach((doc) => {
      try {
        (JSON.parse(doc.topics || "[]") as string[]).forEach((t) => {
          const trimmed = t.trim();
          if (trimmed) topics.add(trimmed);
        });
      } catch {
        // abaikan topics yang gagal di-parse
      }
    });
    return Array.from(topics).sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const docTopicSuggestions = useMemo(() => {
    const q = docTopicInput.trim().toLowerCase();
    if (!q) return [];
    return availableTopics
      .filter((t) => t.toLowerCase().includes(q) && !docFilterTopics.includes(t))
      .slice(0, 8);
  }, [availableTopics, docTopicInput, docFilterTopics]);

  async function handleUpload(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setLoading(true);
    setElapsedSeconds(0);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Gagal upload PDF");
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal upload PDF");
    } finally {
      setLoading(false);
    }
  }


  const activeNavLabel = visibleNavItems.find((n) => n.tab === pageTab)?.label ?? "";

  return (
    <div className="flex min-h-screen w-full flex-col puskim-canvas text-foreground">
      {/* Unified PU Navy + Gold Top Header (Logo PU kiri + KEMENPU pill kanan) */}
      <header className="sticky top-0 z-20 border-b-2 border-[#EAB308]/85 bg-gradient-to-r from-[#0B2347] via-[#123B72] to-[#081A36] shadow-sm">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
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
              <p className="text-base font-extrabold tracking-tight text-white uppercase">
                JP-Insight
              </p>
              <p className="text-[11px] font-medium tracking-wide text-[#FDE68A]">
                Knowledge &amp; Riset · Jurnal Permukiman
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {currentUser && <AccountMenu user={currentUser} onLogout={handleLogout} />}
          </div>
        </div>
      </header>

      <div className="flex min-w-0 flex-1">
        {/* Desktop sidebar (Deep PU Navy + Gold active accent) */}
        <aside className="hidden w-60 shrink-0 flex-col justify-between border-r border-[#081933] bg-gradient-to-b from-[#0E3161] to-[#081A36] p-3.5 text-white shadow-lg md:flex">
          <nav className="flex flex-col gap-1">
            <p className="px-3 pb-1.5 pt-1 text-[10.5px] font-extrabold uppercase tracking-wider text-blue-200/65">
              Konsol Riset
            </p>
            {visibleNavItems.map((item) => {
              const isActive = pageTab === item.tab;
              return (
                <button
                  key={item.tab}
                  onClick={() => setPageTab(item.tab)}
                  className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm transition-all duration-150 ${
                    isActive
                      ? "border-l-4 border-[#EAB308] bg-white font-bold text-[#0F2C59] shadow-md"
                      : "font-medium text-blue-100/90 hover:translate-x-0.5 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-6 border-t border-white/15 pt-3 pb-10 text-xs text-white/75">
            <p className="px-2 font-semibold text-white/90">Basis Pengetahuan</p>
            <p className="mt-0.5 px-2 text-[11px] text-white/70">
              {documents.length} naskah terindeks
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile nav */}
          <div className="flex items-center justify-between gap-3 border-b border-border bg-white px-4 py-3 md:hidden">
            <span className="text-sm font-bold text-stone-900">{activeNavLabel}</span>
            <div className="flex items-center gap-2">
              <select
                value={pageTab}
                onChange={(e) => setPageTab(e.target.value as PageTab)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              >
                {visibleNavItems.map((item) => (
                  <option key={item.tab} value={item.tab}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <main className="flex w-full min-w-0 flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-lg font-bold tracking-tight md:hidden">{activeNavLabel}</h1>

            {pageTab === "regulations" && (
              <div className="w-full">
                <RegulationsPanel isAdmin={Boolean(isAdmin)} />
              </div>
            )}
            {pageTab === "gaps" && (
              <div className="w-full">
                <GapPanel isAdmin={Boolean(isAdmin)} />
              </div>
            )}
            {pageTab === "skills" && isAdmin && (
              <div className="w-full">
                <SkillsPanel />
              </div>
            )}
            {pageTab === "sync" && isAdmin && (
              <div className="w-full">
                <SyncPanel onSynced={loadDocuments} />
              </div>
            )}
            {pageTab === "admin" && isAdmin && (
              <div className="w-full">
                <AdminPanel />
              </div>
            )}

            {pageTab === "documents" && (
              <div className="flex w-full flex-col gap-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 h-7 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-[#123B72] to-[#EAB308]"
                      aria-hidden="true"
                    />
                    <div>
                      <h1 className="hidden text-xl font-bold tracking-tight text-stone-900 md:block">
                        Dokumen Basis Pengetahuan
                      </h1>
                      <p className="mt-0.5 text-sm text-stone-600">
                        {isAdmin
                          ? "Upload PDF manual, atau telusuri naskah yang sudah masuk lewat sinkronisasi OJS."
                          : "Naskah yang sudah masuk ke basis pengetahuan Jurnal Permukiman."}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="gap-2 px-3.5 py-1.5 text-xs font-semibold shadow-xs">
                    <span className="h-2 w-2 rounded-full bg-[#123B72]" aria-hidden="true" />
                    {documents.length} Dokumen Terindeks
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-start">
                  {isAdmin && (
                    <Card className="flex flex-col gap-4 rounded-2xl border-t-[3px] border-t-[#123B72] p-5 shadow-xs xl:col-span-4">
                      <form onSubmit={handleUpload} className="flex flex-col gap-4">
                        <div>
                          <h2 className="flex items-center gap-2 text-sm font-bold text-stone-900">
                            <UploadCloud className="h-4 w-4 text-[#123B72]" />
                            Upload PDF Manual
                          </h2>
                          <p className="mt-0.5 text-xs text-stone-500">
                            Tambahkan dokumen PDF baru ke arsip riset JP-Insight.
                          </p>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="application/pdf"
                          className="rounded-xl border border-dashed border-[#C2CEE0] bg-[#F6F9FD] p-3 text-sm text-stone-800 file:mr-3 file:rounded-lg file:border file:border-[#C7D8EE] file:bg-[#EEF4FC] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#0B254B] hover:file:bg-[#123B72] hover:file:text-white"
                        />

                        <div className="flex flex-col gap-2">
                          <span className="text-xs font-semibold text-stone-600">Mode pembacaan</span>
                          <div className="flex flex-col gap-2 text-sm">
                            <label className="flex cursor-pointer items-center gap-2 text-stone-800">
                              <input
                                type="radio"
                                name="mode"
                                value="local"
                                checked={mode === "local"}
                                onChange={() => setMode("local")}
                                className="accent-[#123B72]"
                              />
                              Lokal (teks asli PDF)
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 text-stone-800">
                              <input
                                type="radio"
                                name="mode"
                                value="gemini"
                                checked={mode === "gemini"}
                                onChange={() => setMode("gemini")}
                                className="accent-[#123B72]"
                              />
                              Gemini (PDF scan/gambar)
                            </label>
                          </div>
                          {mode === "gemini" && (
                            <p className="text-xs text-stone-500">
                              Setiap halaman diproses sebagai gambar oleh AI, jadi bisa memakan
                              waktu 1-3 menit (atau lebih) untuk dokumen banyak halaman. Mode
                              Lokal jauh lebih cepat kalau PDF-nya sudah berisi teks asli.
                            </p>
                          )}
                        </div>

                        <Button
                          type="submit"
                          disabled={loading}
                          className="w-full gap-2 font-bold"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Memproses... ({elapsedSeconds}s)
                            </>
                          ) : (
                            "Upload Dokumen"
                          )}
                        </Button>
                        {loading && mode === "gemini" && (
                          <p className="text-xs text-stone-500">
                            Sedang membaca dengan Gemini, mohon tunggu, jangan tutup halaman
                            ini...
                          </p>
                        )}
                        {error && <p className="text-sm text-destructive">{error}</p>}
                      </form>
                    </Card>
                  )}

                  <div className={`flex flex-col gap-3.5 ${isAdmin ? "xl:col-span-8" : "xl:col-span-12"}`}>
                    <Card className="flex flex-col gap-3 rounded-2xl p-4 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-xs font-bold uppercase tracking-wide text-stone-500">
                          Menampilkan {startDocIndex}–{endDocIndex} dari {filteredDocuments.length} dokumen
                          {filteredDocuments.length !== documents.length && (
                            <span className="ml-1 font-normal text-stone-400">
                              (total {documents.length})
                            </span>
                          )}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="flex items-center gap-1.5 text-xs text-stone-500">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                              Per hal:
                            </span>
                            <select
                              value={docPageSize}
                              onChange={(e) => setDocPageSize(Number(e.target.value))}
                              aria-label="Jumlah dokumen per halaman"
                              className="h-7 rounded-lg border border-[#D9E1EC] bg-[#F6F9FD] px-2 py-0.5 text-xs font-semibold text-stone-700 outline-none focus:border-[#123B72]"
                            >
                              <option value={10}>10</option>
                              <option value={20}>20</option>
                              <option value={50}>50</option>
                            </select>
                          </div>
                          <div className="flex gap-1 rounded-full border border-[#D9E1EC] bg-[#F6F9FD] p-0.5">
                            {(["all", "ojs_harvest", "manual_upload"] as const).map((f) => (
                              <button
                                key={f}
                                onClick={() => setDocSourceFilter(f)}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                                  docSourceFilter === f
                                    ? "bg-[#123B72] text-white shadow-xs"
                                    : "text-stone-600 hover:text-[#0B254B]"
                                }`}
                              >
                                {f === "all" ? "Semua" : SOURCE_LABEL[f]}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                        <Input
                          value={docSearch}
                          onChange={(e) => setDocSearch(e.target.value)}
                          placeholder="Cari judul, penulis, nama file, atau DOI..."
                          className="bg-[#F6F9FD] pl-9.5 text-stone-900"
                        />
                      </div>

                      <div className="flex flex-wrap items-start gap-3 border-t border-[#E6ECF5] pt-3">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-stone-500">Tahun</label>
                          <select
                            value={docFilterYear ?? ""}
                            onChange={(e) =>
                              setDocFilterYear(e.target.value ? Number(e.target.value) : null)
                            }
                            className="rounded-lg border border-[#D9E1EC] bg-[#F6F9FD] px-2.5 py-1 text-xs text-stone-800 outline-none focus:border-[#123B72]"
                          >
                            <option value="">Semua tahun</option>
                            {availableYears.map((year) => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="relative flex min-w-0 flex-1 flex-col gap-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <label className="text-xs font-semibold text-stone-500">Tema</label>
                            {docFilterTopics.map((topic) => (
                              <Badge
                                key={topic}
                                variant="secondary"
                                className="gap-1 px-2.5 py-0.5 text-xs font-semibold"
                              >
                                {topic}
                                <button
                                  onClick={() =>
                                    setDocFilterTopics((prev) => prev.filter((t) => t !== topic))
                                  }
                                  aria-label={`Hapus filter ${topic}`}
                                  className="ml-0.5 hover:opacity-70"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                            <Input
                              value={docTopicInput}
                              onChange={(e) => setDocTopicInput(e.target.value)}
                              placeholder={
                                docFilterTopics.length === 0
                                  ? "Cari tema, mis. beton, tsunami..."
                                  : "Tambah tema..."
                              }
                              className="h-8 min-w-[140px] flex-1 bg-[#F6F9FD] text-xs text-stone-800"
                            />
                          </div>
                          {docTopicSuggestions.length > 0 && (
                            <ul className="popover-panel absolute top-full z-10 mt-1 w-full max-w-xs rounded-xl border border-[#D9E1EC] bg-white shadow-md">
                              {docTopicSuggestions.map((topic) => (
                                <li key={topic}>
                                  <button
                                    onClick={() => {
                                      setDocFilterTopics((prev) => [...prev, topic]);
                                      setDocTopicInput("");
                                    }}
                                    className="block w-full px-3 py-1.5 text-left text-xs text-stone-800 hover:bg-[#EEF4FC] hover:text-[#0B254B]"
                                  >
                                    {topic}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {(docFilterYear || docFilterTopics.length > 0) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDocFilterYear(null);
                              setDocFilterTopics([]);
                            }}
                            className="h-8 shrink-0 text-xs font-semibold text-[#0B254B]"
                          >
                            Reset filter
                          </Button>
                        )}
                      </div>
                    </Card>

                    {documents.length === 0 && (
                      <Card className="rounded-2xl p-8 text-center text-sm text-stone-500 shadow-xs">
                        Belum ada dokumen diupload.
                      </Card>
                    )}
                    {documents.length > 0 && filteredDocuments.length === 0 && (
                      <Card className="rounded-2xl p-8 text-center text-sm text-stone-500 shadow-xs">
                        Tidak ada dokumen yang cocok dengan pencarian.
                      </Card>
                    )}
                    <ul className="flex flex-col gap-3">
                      {paginatedDocuments.map((doc) => {
                        const authors: string[] = (() => {
                          try {
                            return JSON.parse(doc.authors || "[]");
                          } catch {
                            return [];
                          }
                        })();
                        return (
                          <li key={doc.id}>
                            <Card className="group flex items-center justify-between gap-4 rounded-2xl p-4 text-sm transition-all duration-150 hover:border-[#C7D8EE] hover:bg-[#F8FAFD] shadow-xs">
                              <div className="flex min-w-0 flex-col gap-1.5">
                                <span className="font-serif text-[15px] sm:text-[16px] font-bold leading-[1.35] text-stone-900 transition-colors group-hover:text-[#0B254B] line-clamp-2">
                                  {doc.title || doc.filename}
                                </span>
                                {authors.length > 0 && (
                                  <span className="text-xs leading-[1.45] text-stone-600 line-clamp-1">
                                    {authors.join(", ")}
                                    {doc.published_year ? ` · ${doc.published_year}` : ""}
                                  </span>
                                )}
                                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                                  <Badge variant="secondary">
                                    {SOURCE_LABEL[doc.source] ?? "Manual"}
                                  </Badge>
                                  <Badge variant="outline">
                                    {METHOD_LABEL[doc.extraction_method]}
                                  </Badge>
                                  <span>{doc.page_count} halaman</span>
                                  {doc.doi && (
                                    <span className="font-mono text-[11px] text-stone-600">
                                      DOI: {doc.doi}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button
                                asChild
                                variant="secondary"
                                size="sm"
                                className="shrink-0 gap-1 font-bold"
                              >
                                <Link
                                  href={`/documents/${doc.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Detail <ChevronRight className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            </Card>
                          </li>
                        );
                      })}
                    </ul>

                    {totalDocPages > 1 && (
                      <div className="mt-2 flex flex-col items-center justify-between gap-3 rounded-2xl border border-[#D9E1EC] bg-white p-3.5 shadow-xs sm:flex-row">
                        <p className="text-xs text-stone-500">
                          Halaman <span className="font-bold text-stone-800">{docPage}</span> dari{" "}
                          <span className="font-bold text-stone-800">{totalDocPages}</span>
                        </p>
                        <Pagination className="mx-0 w-auto justify-end">
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() => {
                                  setDocPage((prev) => Math.max(1, prev - 1));
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                disabled={docPage <= 1}
                              />
                            </PaginationItem>
                            {docPaginationItems.map((item) =>
                              typeof item === "string" ? (
                                <PaginationItem key={item}>
                                  <PaginationEllipsis />
                                </PaginationItem>
                              ) : (
                                <PaginationItem key={item}>
                                  <PaginationLink
                                    isActive={docPage === item}
                                    onClick={() => {
                                      setDocPage(item);
                                      window.scrollTo({ top: 0, behavior: "smooth" });
                                    }}
                                  >
                                    {item}
                                  </PaginationLink>
                                </PaginationItem>
                              )
                            )}
                            <PaginationItem>
                              <PaginationNext
                                onClick={() => {
                                  setDocPage((prev) => Math.min(totalDocPages, prev + 1));
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                disabled={docPage >= totalDocPages}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          {pageTab === "chat" && (
            <ChatPanel
              currentUser={currentUser}
              availableYears={availableYears}
              availableTopics={availableTopics}
            />
          )}
          </main>

          <footer className="mt-auto border-t border-[#D9E1EC] bg-white/80 backdrop-blur-xs">
            <div className="flex w-full flex-col items-start justify-between gap-2 px-4 py-3 text-xs text-stone-500 sm:flex-row sm:items-center sm:px-6 lg:px-8">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#123B72]" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-stone-700">JP-Insight</strong> · Jurnal
                  Permukiman — Direktorat Bina Teknik Permukiman dan Perumahan, Kementerian PU
                </span>
              </div>
              <div className="flex items-center gap-4">
                <a
                  href="http://localhost/jurnalpermukiman/index.php/JP"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#0B254B] transition-colors hover:underline"
                >
                  Portal OJS ↗
                </a>
                <a
                  href="http://localhost:3000/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-stone-600 transition-colors hover:text-[#0B254B]"
                >
                  MQC Assistant ↗
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {pageTab !== "chat" && <ChatWidget onOpen={() => setPageTab("chat")} />}
    </div>
  );
}

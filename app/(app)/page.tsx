"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import SkillsPanel from "@/app/components/SkillsPanel";
import SyncPanel from "@/app/components/SyncPanel";
import AdminPanel from "@/app/components/AdminPanel";
import RegulationsPanel from "@/app/components/RegulationsPanel";
import GapPanel from "@/app/components/GapPanel";
import ChatWidget from "@/app/components/ChatWidget";
import AccountMenu from "@/app/components/AccountMenu";

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
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path
          d="M5 2.5h7l3 3V17a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path d="M12 2.5V6h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M7 10.5h6M7 13.5h6M7 7.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    tab: "chat",
    label: "Chat & Kajian",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path
          d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v7A1.5 1.5 0 0 1 15.5 13H8l-3.5 3.5V13H4.5A1.5 1.5 0 0 1 3 11.5v-7Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    tab: "regulations",
    label: "Peraturan Dirujuk",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path
          d="M10 4.2c-1.5-1-3.2-1.4-5-1.2v11c1.8-.2 3.5.2 5 1.2 1.5-1 3.2-1.4 5-1.2V3c-1.8-.2-3.5.2-5 1.2Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path d="M10 4.2v11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    tab: "gaps",
    label: "Celah Riset",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M9 6.5v3M9 11.6v.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    tab: "skills",
    label: "Skill",
    adminOnly: true,
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path
          d="M10 2.5l1.7 3.6 3.9.5-2.9 2.7.7 3.9L10 11.3l-3.4 1.9.7-3.9-2.9-2.7 3.9-.5L10 2.5Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    tab: "sync",
    label: "Sinkronisasi OJS",
    adminOnly: true,
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path
          d="M4 6a6 6 0 0 1 10-2M16 14a6 6 0 0 1-10 2"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path d="M14 3.5V6h-2.5M6 16.5V14h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    tab: "admin",
    label: "Admin",
    adminOnly: true,
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path
          d="M10 2.5 3.5 5v4.5c0 4 2.7 6.9 6.5 8 3.8-1.1 6.5-4 6.5-8V5L10 2.5Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="9" r="1.6" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
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
  const [mode, setMode] = useState<ExtractionMethod>("local");
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [queryMode, setQueryMode] = useState<QueryMode>("chat");
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [filterTopics, setFilterTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    let ignore = false;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) setCurrentUser(data.user ?? null);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const isAdmin = currentUser?.role === "admin";
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
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

  useEffect(() => {
    let ignore = false;
    fetch("/api/chat/history")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) setChatHistory(data.history ?? []);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
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

  const topicSuggestions = useMemo(() => {
    const q = topicInput.trim().toLowerCase();
    if (!q) return [];
    return availableTopics
      .filter((t) => t.toLowerCase().includes(q) && !filterTopics.includes(t))
      .slice(0, 8);
  }, [availableTopics, topicInput, filterTopics]);

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

  async function handleSendChat(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const question = chatInput.trim();
    if (!question || chatLoading) return;

    setActiveHistoryId(null);
    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: question, timestamp: new Date().toISOString() },
    ]);
    setChatInput("");
    setChatLoading(true);
    setChatError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          mode: queryMode,
          filters: {
            year: filterYear ?? undefined,
            topics: filterTopics.length > 0 ? filterTopics : undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal mendapatkan jawaban");
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources ?? [],
          timestamp: data.created_at ?? new Date().toISOString(),
          queryMode: data.mode,
          evidenceStrength: data.evidenceStrength ?? null,
          points: data.points ?? null,
        },
      ]);
      setActiveHistoryId(data.id);
      setChatHistory((prev) => [
        {
          id: data.id,
          question,
          created_at: data.created_at,
          mode: data.mode,
          evidence_strength: data.evidenceStrength ?? null,
        },
        ...prev,
      ]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Gagal mendapatkan jawaban");
    } finally {
      setChatLoading(false);
    }
  }

  async function handleSelectHistory(historyId: string) {
    if (historyId === activeHistoryId) return;
    setHistoryLoadingId(historyId);
    setChatError(null);
    try {
      const res = await fetch(`/api/chat/history/${historyId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat riwayat chat");
      setChatMessages([
        {
          role: "user",
          content: data.history.question,
          timestamp: data.history.created_at,
        },
        {
          role: "assistant",
          content: data.history.answer,
          sources: data.history.sources ?? [],
          timestamp: data.history.created_at,
          queryMode: data.history.mode,
          evidenceStrength: data.history.evidenceStrength ?? null,
          points: data.history.points ?? null,
        },
      ]);
      setQueryMode(data.history.mode === "kajian" ? "kajian" : "chat");
      setActiveHistoryId(historyId);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Gagal memuat riwayat chat");
    } finally {
      setHistoryLoadingId(null);
    }
  }

  function handleNewChat() {
    setChatMessages([]);
    setActiveHistoryId(null);
    setChatError(null);
  }

  async function handleDeleteHistory(
    mouseEvent: React.MouseEvent<HTMLButtonElement>,
    historyId: string
  ) {
    mouseEvent.stopPropagation();
    const removed = chatHistory.find((item) => item.id === historyId);
    setChatHistory((prev) => prev.filter((item) => item.id !== historyId));
    if (activeHistoryId === historyId) handleNewChat();

    try {
      const res = await fetch(`/api/chat/history/${historyId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      if (removed) setChatHistory((prev) => [removed, ...prev]);
      setChatError("Gagal menghapus riwayat, coba lagi");
    }
  }

  const activeNavLabel = visibleNavItems.find((n) => n.tab === pageTab)?.label ?? "";

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="border-b border-border px-5 py-5">
          <div className="text-sm font-semibold tracking-tight">JP-Insight</div>
          <div className="text-xs text-muted">Jurnal Permukiman</div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          {visibleNavItems.map((item) => (
            <button
              key={item.tab}
              onClick={() => setPageTab(item.tab)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                pageTab === item.tab
                  ? "bg-accent-soft text-accent-text"
                  : "text-muted hover:bg-background hover:text-foreground"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile nav */}
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 md:hidden">
          <span className="text-sm font-semibold">JP-Insight</span>
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
            <button
              onClick={handleLogout}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-red-200 hover:text-red-600 dark:hover:border-red-900 dark:hover:text-red-400"
            >
              Keluar
            </button>
          </div>
        </div>

        {/* Desktop top bar */}
        {currentUser && (
          <div className="hidden items-center justify-end border-b border-border bg-surface px-8 py-3 md:flex">
            <AccountMenu user={currentUser} onLogout={handleLogout} />
          </div>
        )}

        <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
          <h1 className="text-lg font-semibold tracking-tight md:hidden">{activeNavLabel}</h1>

          {pageTab === "regulations" && (
            <div className="mx-auto w-full max-w-4xl">
              <RegulationsPanel isAdmin={Boolean(isAdmin)} />
            </div>
          )}
          {pageTab === "gaps" && (
            <div className="mx-auto w-full max-w-4xl">
              <GapPanel isAdmin={Boolean(isAdmin)} />
            </div>
          )}
          {pageTab === "skills" && isAdmin && (
            <div className="mx-auto w-full max-w-3xl">
              <SkillsPanel />
            </div>
          )}
          {pageTab === "sync" && isAdmin && (
            <div className="mx-auto w-full max-w-3xl">
              <SyncPanel onSynced={loadDocuments} />
            </div>
          )}
          {pageTab === "admin" && isAdmin && (
            <div className="mx-auto w-full max-w-4xl">
              <AdminPanel />
            </div>
          )}

          {pageTab === "documents" && (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
              <div>
                <h1 className="hidden text-xl font-semibold tracking-tight md:block">
                  Dokumen
                </h1>
                <p className="mt-1 text-sm text-muted">
                  {isAdmin
                    ? "Upload PDF manual, atau lihat naskah yang sudah masuk lewat sinkronisasi OJS."
                    : "Naskah yang sudah masuk ke basis pengetahuan Jurnal Permukiman."}
                </p>
              </div>

              {isAdmin && (
              <form
                onSubmit={handleUpload}
                className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="text-sm text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent-text"
                />

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-muted">Mode pembacaan</span>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2 text-foreground">
                      <input
                        type="radio"
                        name="mode"
                        value="local"
                        checked={mode === "local"}
                        onChange={() => setMode("local")}
                      />
                      Lokal (teks asli PDF)
                    </label>
                    <label className="flex items-center gap-2 text-foreground">
                      <input
                        type="radio"
                        name="mode"
                        value="gemini"
                        checked={mode === "gemini"}
                        onChange={() => setMode("gemini")}
                      />
                      Gemini (PDF scan/gambar)
                    </label>
                  </div>
                  {mode === "gemini" && (
                    <p className="text-xs text-muted">
                      Setiap halaman diproses sebagai gambar oleh AI, jadi bisa memakan
                      waktu 1-3 menit (atau lebih) untuk dokumen banyak halaman. Mode
                      Lokal jauh lebih cepat kalau PDF-nya sudah berisi teks asli (bukan
                      hasil scan).
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="press w-fit rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? `Memproses... (${elapsedSeconds}s)` : "Upload"}
                </button>
                {loading && mode === "gemini" && (
                  <p className="text-xs text-muted">
                    Sedang membaca dengan Gemini, mohon tunggu, jangan tutup halaman
                    ini...
                  </p>
                )}
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              </form>
              )}

              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-medium text-muted">
                    {filteredDocuments.length} dari {documents.length} dokumen
                  </h2>
                  <div className="flex gap-1 rounded-full border border-border bg-surface p-0.5">
                    {(["all", "ojs_harvest", "manual_upload"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setDocSourceFilter(f)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          docSourceFilter === f
                            ? "bg-accent text-accent-foreground"
                            : "text-muted hover:text-foreground"
                        }`}
                      >
                        {f === "all" ? "Semua" : SOURCE_LABEL[f]}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder="Cari judul, penulis, nama file, atau DOI..."
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                />

                <div className="flex flex-wrap items-start gap-3 rounded-xl border border-border bg-surface p-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-muted">Tahun</label>
                    <select
                      value={docFilterYear ?? ""}
                      onChange={(e) =>
                        setDocFilterYear(e.target.value ? Number(e.target.value) : null)
                      }
                      className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-accent"
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
                      <label className="text-xs font-medium text-muted">Tema</label>
                      {docFilterTopics.map((topic) => (
                        <span
                          key={topic}
                          className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-text"
                        >
                          {topic}
                          <button
                            onClick={() =>
                              setDocFilterTopics((prev) => prev.filter((t) => t !== topic))
                            }
                            aria-label={`Hapus filter ${topic}`}
                            className="hover:opacity-70"
                          >
                            &#10005;
                          </button>
                        </span>
                      ))}
                      <input
                        value={docTopicInput}
                        onChange={(e) => setDocTopicInput(e.target.value)}
                        placeholder={
                          docFilterTopics.length === 0
                            ? "Cari tema, mis. beton, tsunami..."
                            : "Tambah tema..."
                        }
                        className="min-w-[140px] flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-accent"
                      />
                    </div>
                    {docTopicSuggestions.length > 0 && (
                      <ul className="popover-panel absolute top-full z-10 mt-1 w-full max-w-xs rounded-lg border border-border bg-surface shadow-md">
                        {docTopicSuggestions.map((topic) => (
                          <li key={topic}>
                            <button
                              onClick={() => {
                                setDocFilterTopics((prev) => [...prev, topic]);
                                setDocTopicInput("");
                              }}
                              className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent-soft hover:text-accent-text"
                            >
                              {topic}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {(docFilterYear || docFilterTopics.length > 0) && (
                    <button
                      onClick={() => {
                        setDocFilterYear(null);
                        setDocFilterTopics([]);
                      }}
                      className="shrink-0 text-xs font-medium text-muted hover:text-foreground"
                    >
                      Reset filter
                    </button>
                  )}
                </div>

                {documents.length === 0 && (
                  <p className="text-sm text-muted">Belum ada dokumen diupload.</p>
                )}
                {documents.length > 0 && filteredDocuments.length === 0 && (
                  <p className="text-sm text-muted">Tidak ada dokumen yang cocok dengan pencarian.</p>
                )}
                <ul className="flex flex-col gap-2">
                  {filteredDocuments.map((doc) => {
                    const authors: string[] = (() => {
                      try {
                        return JSON.parse(doc.authors || "[]");
                      } catch {
                        return [];
                      }
                    })();
                    return (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm"
                      >
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="truncate font-medium text-foreground">
                            {doc.title || doc.filename}
                          </span>
                          {authors.length > 0 && (
                            <span className="truncate text-xs text-muted">
                              {authors.join(", ")}
                              {doc.published_year ? ` · ${doc.published_year}` : ""}
                            </span>
                          )}
                          <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span className="rounded-full border border-border px-2 py-0.5">
                              {SOURCE_LABEL[doc.source] ?? "Manual"}
                            </span>
                            <span className="rounded-full border border-border px-2 py-0.5">
                              {METHOD_LABEL[doc.extraction_method]}
                            </span>
                            {doc.page_count} halaman
                            {doc.doi && <span className="font-mono">DOI: {doc.doi}</span>}
                          </span>
                        </div>
                        <Link
                          href={`/documents/${doc.id}`}
                          className="shrink-0 text-sm font-medium text-accent-text hover:underline"
                        >
                          Detail &rarr;
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          {pageTab === "chat" && (
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 md:flex-row">
              <div className="flex shrink-0 flex-col gap-2 md:w-56">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-muted">Riwayat</h2>
                  <button
                    onClick={handleNewChat}
                    className="text-xs font-medium text-accent-text hover:underline"
                  >
                    + Baru
                  </button>
                </div>
                {chatHistory.length === 0 && (
                  <p className="text-xs text-muted">Belum ada riwayat percakapan.</p>
                )}
                <ul className="flex flex-col gap-1 md:max-h-[500px] md:overflow-y-auto">
                  {chatHistory.map((item) => (
                    <li key={item.id} className="flex items-center gap-1">
                      <button
                        onClick={() => handleSelectHistory(item.id)}
                        className={`min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                          activeHistoryId === item.id
                            ? "bg-accent-soft text-accent-text"
                            : "text-muted hover:bg-surface hover:text-foreground"
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          {item.mode === "kajian" && (
                            <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent-text">
                              Kajian
                            </span>
                          )}
                          <span className="truncate">
                            {historyLoadingId === item.id ? "Memuat..." : item.question}
                          </span>
                        </span>
                      </button>
                      <button
                        onClick={(e) => handleDeleteHistory(e, item.id)}
                        title="Hapus riwayat"
                        aria-label="Hapus riwayat"
                        className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                      >
                        &#10005;
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-sm text-muted">
                    {queryMode === "kajian"
                      ? "Mode Kajian: sintesis temuan dari beberapa naskah sekaligus, lengkap dengan indikator kekuatan bukti per klaim."
                      : "Tanyakan apa saja dari seluruh dokumen yang sudah di-embed. Jawaban disusun AI hanya berdasarkan isi dokumen kamu."}
                  </p>
                  <div className="flex shrink-0 gap-1 rounded-full border border-border bg-surface p-0.5">
                    <button
                      onClick={() => setQueryMode("chat")}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        queryMode === "chat"
                          ? "bg-accent text-accent-foreground"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      Chat
                    </button>
                    <button
                      onClick={() => setQueryMode("kajian")}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        queryMode === "kajian"
                          ? "bg-accent text-accent-foreground"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      Kajian
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-start gap-3 rounded-xl border border-border bg-surface p-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-muted">Tahun</label>
                    <select
                      value={filterYear ?? ""}
                      onChange={(e) =>
                        setFilterYear(e.target.value ? Number(e.target.value) : null)
                      }
                      className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-accent"
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
                      <label className="text-xs font-medium text-muted">Tema</label>
                      {filterTopics.map((topic) => (
                        <span
                          key={topic}
                          className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-text"
                        >
                          {topic}
                          <button
                            onClick={() =>
                              setFilterTopics((prev) => prev.filter((t) => t !== topic))
                            }
                            aria-label={`Hapus filter ${topic}`}
                            className="hover:opacity-70"
                          >
                            &#10005;
                          </button>
                        </span>
                      ))}
                      <input
                        value={topicInput}
                        onChange={(e) => setTopicInput(e.target.value)}
                        placeholder={
                          filterTopics.length === 0 ? "Cari tema, mis. beton, tsunami..." : "Tambah tema..."
                        }
                        className="min-w-[140px] flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-accent"
                      />
                    </div>
                    {topicSuggestions.length > 0 && (
                      <ul className="popover-panel absolute top-full z-10 mt-1 w-full max-w-xs rounded-lg border border-border bg-surface shadow-md">
                        {topicSuggestions.map((topic) => (
                          <li key={topic}>
                            <button
                              onClick={() => {
                                setFilterTopics((prev) => [...prev, topic]);
                                setTopicInput("");
                              }}
                              className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent-soft hover:text-accent-text"
                            >
                              {topic}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {(filterYear || filterTopics.length > 0) && (
                    <button
                      onClick={() => {
                        setFilterYear(null);
                        setFilterTopics([]);
                      }}
                      className="shrink-0 text-xs font-medium text-muted hover:text-foreground"
                    >
                      Reset filter
                    </button>
                  )}
                </div>

                <div className="flex max-h-[65vh] min-h-[300px] flex-col gap-1.5 overflow-y-auto rounded-xl border border-border bg-[#e9e4da] p-4 dark:bg-[#0b141a]">
                  {chatMessages.length === 0 && (
                    <p className="m-auto text-sm text-muted">
                      Belum ada percakapan. Coba tanyakan sesuatu tentang dokumenmu di
                      bawah, atau klik salah satu riwayat di samping.
                    </p>
                  )}
                  {chatMessages.map((message, i) => {
                    const isKajian =
                      message.role === "assistant" && message.queryMode === "kajian";
                    return (
                      <div
                        key={i}
                        className={`chat-bubble-enter flex flex-col gap-1 ${
                          message.role === "user" ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6 shadow-sm ${
                            message.role === "user"
                              ? "rounded-br-sm bg-[#d9fdd3] text-zinc-900 dark:bg-[#005c4b] dark:text-zinc-50"
                              : "rounded-bl-sm bg-white text-zinc-800 dark:bg-[#202c33] dark:text-zinc-100"
                          }`}
                        >
                          {isKajian && message.evidenceStrength && (
                            <span
                              className={`mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${EVIDENCE_CLASS[message.evidenceStrength]}`}
                            >
                              Kekuatan Bukti: {EVIDENCE_LABEL[message.evidenceStrength]}
                            </span>
                          )}
                          <p>{message.content}</p>

                          {isKajian && message.points && message.points.length > 0 && (
                            <ol className="mt-2 flex flex-col gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
                              {message.points.map((point, pi) => (
                                <li key={pi} className="text-sm">
                                  <div className="flex items-start gap-1.5">
                                    <span className="shrink-0 font-medium text-zinc-500">
                                      {pi + 1}.
                                    </span>
                                    <span>
                                      {point.claim}
                                      {point.needsVerification && (
                                        <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                                          perlu verifikasi tambahan
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="ml-4 mt-1 flex flex-wrap gap-1">
                                    {point.sources.map((s, si) => (
                                      <Link
                                        key={si}
                                        href={`/documents/${s.document_id}`}
                                        className="rounded-full border border-zinc-300 bg-white/80 px-2 py-0.5 text-[11px] text-zinc-600 hover:border-accent hover:text-accent-text dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400"
                                      >
                                        {s.filename}
                                      </Link>
                                    ))}
                                  </div>
                                </li>
                              ))}
                            </ol>
                          )}

                          <span className="mt-1 block text-right text-[10px] leading-none text-zinc-500 dark:text-zinc-400">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                        {!isKajian &&
                          message.role === "assistant" &&
                          message.sources &&
                          message.sources.length > 0 && (
                            <div className="flex max-w-[75%] flex-wrap gap-1.5">
                              {message.sources.map((source, j) => (
                                <Link
                                  key={j}
                                  href={`/documents/${source.document_id}`}
                                  className="rounded-full border border-zinc-300 bg-white/80 px-2 py-0.5 text-xs text-zinc-600 hover:border-accent hover:text-accent-text dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400"
                                >
                                  {source.filename} &middot; bagian {source.chunk_index + 1}
                                </Link>
                              ))}
                            </div>
                          )}
                      </div>
                    );
                  })}
                  {chatLoading && (
                    <div className="chat-bubble-enter flex items-start">
                      <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-zinc-500 shadow-sm dark:bg-[#202c33] dark:text-zinc-400">
                        AI sedang berpikir...
                      </div>
                    </div>
                  )}
                  {chatError && (
                    <p className="fade-in text-sm text-red-600 dark:text-red-400">{chatError}</p>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleSendChat} className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Tanyakan sesuatu dari dokumenmu..."
                    className="flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm outline-none focus:border-accent"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="press shrink-0 rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    Kirim
                  </button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>

      {pageTab !== "chat" && <ChatWidget onOpen={() => setPageTab("chat")} />}
    </div>
  );
}

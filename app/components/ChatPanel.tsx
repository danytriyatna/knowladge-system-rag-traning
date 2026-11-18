"use client";

import * as React from "react";
import Link from "next/link";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
} from "@/components/ui/message";
import {
  Bubble,
  BubbleContent,
} from "@/components/ui/bubble";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputSubmit,
} from "@/components/ui/prompt-input";
import {
  TraceCard,
  TraceCardHeader,
  TraceCardContent,
} from "@/components/ui/trace-card";
import {
  ChatHistory,
  ChatHistoryHeader,
  ChatHistoryTitle,
  ChatHistoryNewButton,
  ChatHistorySearch,
  ChatHistoryContent,
  ChatHistoryGroup,
  ChatHistoryGroupLabel,
  ChatHistoryItem as CentralizedChatHistoryItem,
  ChatHistoryEmpty,
  CentralizedChatHistory,
  type ChatHistoryRecord,
} from "@/components/ui/chat-history";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  BookOpen,
  Sparkles,
  Send,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  X,
  RotateCcw,
} from "lucide-react";

export type QueryMode = "chat" | "kajian";
export type EvidenceStrength = "kuat" | "sedang" | "lemah";

export interface ChatSource {
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
  source?: string;
  source_url?: string | null;
  snippet?: string;
}

export interface KajianPoint {
  claim: string;
  sources: ChatSource[];
  needsVerification: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  timestamp: string;
  queryMode?: QueryMode;
  evidenceStrength?: EvidenceStrength | null;
  points?: KajianPoint[] | null;
}

export interface ChatHistoryItem {
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

interface ChatPanelProps {
  currentUser?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
  availableYears?: number[];
  availableTopics?: string[];
}

export default function ChatPanel({
  currentUser,
  availableYears = [],
  availableTopics = [],
}: ChatPanelProps) {
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
  const [queryMode, setQueryMode] = React.useState<QueryMode>("chat");
  const [filterYear, setFilterYear] = React.useState<number | null>(null);
  const [filterTopics, setFilterTopics] = React.useState<string[]>([]);
  const [topicInput, setTopicInput] = React.useState("");
  const [chatInput, setChatInput] = React.useState("");
  const [chatLoading, setChatLoading] = React.useState(false);
  const [chatError, setChatError] = React.useState<string | null>(null);
  const [chatHistory, setChatHistory] = React.useState<ChatHistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = React.useState<string | null>(null);
  const [historyLoadingId, setHistoryLoadingId] = React.useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  // Fetch initial history
  React.useEffect(() => {
    let ignore = false;
    fetch("/api/chat/history")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) setChatHistory(data.history ?? []);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  const topicSuggestions = React.useMemo(() => {
    const q = topicInput.trim().toLowerCase();
    if (!q) return [];
    return availableTopics
      .filter((t) => t.toLowerCase().includes(q) && !filterTopics.includes(t))
      .slice(0, 8);
  }, [availableTopics, filterTopics, topicInput]);

  function handleCopyMessage(index: number, text: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  }

  function handleNewChat() {
    setChatMessages([]);
    setActiveHistoryId(null);
    setChatError(null);
  }

  async function handleSendChat(formEvent?: React.FormEvent<HTMLFormElement>) {
    if (formEvent) formEvent.preventDefault();
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
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? `Gagal memperoleh jawaban (HTTP ${res.status})`);
      }
      if (!data) {
        throw new Error(`Respons server tidak valid (HTTP ${res.status})`);
      }
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
      setChatInput((prev) => (prev.trim() ? prev : question));
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
      {/* Top Banner: Penjelasan Mode & Status Validitas OJS */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-xs leading-relaxed text-stone-600 sm:text-sm">
          {queryMode === "kajian"
            ? "Mode Kajian: Sintesis temuan multi-naskah komprehensif dilengkapi matriks kekuatan bukti per klaim ilmiah."
            : "Mode Chat: Tanya jawab interaktif dirujuk langsung dari naskah resmi terbit Jurnal Permukiman OJS."}
        </p>
        <Badge variant="success" className="gap-1.5 py-1 text-xs shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          Hanya Jurnal Publish OJS
        </Badge>
      </div>

      {/* Main Container: 2 Kolom Setara Sempurna (Sidebar Riwayat & Chat Pane) */}
      <div className="flex w-full flex-col gap-4 md:flex-row items-stretch">
        {/* Sidebar Riwayat Percakapan Terpusat */}
        <CentralizedChatHistory
          items={chatHistory}
          activeId={activeHistoryId}
          loadingId={historyLoadingId}
          onSelect={handleSelectHistory}
          onDelete={handleDeleteHistory}
          onNewChat={handleNewChat}
          className="w-full md:w-64 lg:w-72 h-[700px] max-h-[78vh]"
        />

        {/* Unified Shadcn Card Container */}
        <Card className="flex flex-1 flex-col h-[700px] max-h-[78vh] min-w-0 rounded-2xl border border-[#D9E1EC] bg-white shadow-xs overflow-hidden gap-0">
          {/* Card Header: Filter Tahun & Tema + Bersihkan */}
          <CardHeader className="p-3 border-b border-[#E6ECF5] bg-white flex flex-wrap flex-row items-center justify-between gap-3 space-y-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-stone-500">Tahun</label>
                <select
                  value={filterYear ?? ""}
                  onChange={(e) =>
                    setFilterYear(e.target.value ? Number(e.target.value) : null)
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

              <div className="relative flex items-center gap-1.5">
                <label className="text-xs font-semibold text-stone-500">Tema</label>
                {filterTopics.map((topic) => (
                  <Badge
                    key={topic}
                    variant="secondary"
                    className="gap-1 px-2.5 py-0.5 text-xs font-semibold"
                  >
                    {topic}
                    <button
                      type="button"
                      onClick={() =>
                        setFilterTopics((prev) => prev.filter((t) => t !== topic))
                      }
                      aria-label={`Hapus filter ${topic}`}
                      className="ml-0.5 hover:opacity-70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Input
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  placeholder={
                    filterTopics.length === 0
                      ? "Filter tema, mis. beton..."
                      : "Tambah..."
                  }
                  className="h-7 w-36 bg-[#F6F9FD] text-xs text-stone-800"
                />
                {topicSuggestions.length > 0 && (
                  <ul className="popover-panel absolute top-full left-0 z-30 mt-1 w-48 rounded-xl border border-[#D9E1EC] bg-white shadow-md">
                    {topicSuggestions.map((topic) => (
                      <li key={topic}>
                        <button
                          type="button"
                          onClick={() => {
                            setFilterTopics((prev) => [...prev, topic]);
                            setTopicInput("");
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

              {(filterYear || filterTopics.length > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterYear(null);
                    setFilterTopics([]);
                  }}
                  className="h-7 px-2 text-xs font-semibold text-[#0B254B]"
                >
                  Reset filter
                </Button>
              )}
            </div>

            {chatMessages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
                className="h-7 gap-1 px-2 text-xs font-semibold text-stone-500 hover:text-[#123B72]"
                title="Bersihkan obrolan"
              >
                <RotateCcw className="h-3 w-3" /> Bersihkan
              </Button>
            )}
          </CardHeader>

          {/* Card Content: MessageScroller Thread */}
          <CardContent className="flex-1 overflow-hidden p-0 relative bg-[#F8FAFD]">
            <MessageScrollerProvider autoScroll={true}>
              <MessageScroller className="h-full">
                <MessageScrollerViewport>
                  <MessageScrollerContent className="p-4 sm:p-5">
                    {chatMessages.length === 0 && (
                      <div className="m-auto flex flex-col items-center justify-center gap-3 py-20 text-center text-stone-500">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF4FC] text-[#123B72] shadow-xs">
                          <Sparkles className="h-6 w-6 text-[#123B72]" />
                        </div>
                        <div className="max-w-md">
                          <p className="font-bold text-stone-800">
                            {queryMode === "kajian"
                              ? "Mulai Sintesis Kajian Ilmiah"
                              : "Mulai Percakapan RAG Dokumen"}
                          </p>
                          <p className="mt-1 text-xs text-stone-500 leading-relaxed">
                            {queryMode === "kajian"
                              ? "Ajukan topik telaah teknis untuk menghasilkan sintesis multi-naskah lengkap dengan matriks kekuatan bukti."
                              : "Tanyakan apapun seputar standar, penelitian, atau konstruksi perumahan. Jawaban dirujuk langsung dari arsip Jurnal Permukiman resmi."}
                          </p>
                        </div>
                      </div>
                    )}

                    {chatMessages.map((message, i) => {
                      const isUser = message.role === "user";
                      const isKajian =
                        message.role === "assistant" && message.queryMode === "kajian";

                      return (
                        <MessageScrollerItem
                          key={i}
                          messageId={`msg-${i}`}
                          scrollAnchor={isUser}
                        >
                          <Message align={isUser ? "end" : "start"}>
                            <MessageAvatar
                              role={isUser ? "user" : "assistant"}
                              initials={currentUser?.fullName || "AD"}
                            />
                            <MessageContent>
                              {isKajian && message.evidenceStrength && (
                                <MessageHeader>
                                  <span
                                    className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${EVIDENCE_CLASS[message.evidenceStrength]}`}
                                  >
                                    Kekuatan Bukti: {EVIDENCE_LABEL[message.evidenceStrength]}
                                  </span>
                                </MessageHeader>
                              )}

                              <Bubble variant={isUser ? "primary" : "default"}>
                                <BubbleContent>
                                  <p className="whitespace-pre-wrap">{message.content}</p>
                                </BubbleContent>
                              </Bubble>

                              {/* Mode Kajian Trace: Poin Sintesis Temuan */}
                              {isKajian && message.points && message.points.length > 0 && (
                                <TraceCard defaultOpen={true}>
                                  <TraceCardHeader
                                    icon={<Sparkles className="h-4 w-4 text-[#EAB308]" />}
                                    title="Poin Temuan & Sintesis Ilmiah"
                                    badge={
                                      <Badge variant="gold" className="px-2 py-0.5 text-[10px]">
                                        {message.points.length} Poin
                                      </Badge>
                                    }
                                  />
                                  <TraceCardContent>
                                    <ol className="flex flex-col gap-2.5">
                                      {message.points.map((point, pi) => (
                                        <li
                                          key={pi}
                                          className="rounded-xl border border-[#E6ECF5] bg-[#F8FAFD] p-2.5"
                                        >
                                          <div className="flex items-start gap-2">
                                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#123B72] text-[10px] font-bold text-white">
                                              {pi + 1}
                                            </span>
                                            <div className="flex-1 text-xs leading-relaxed text-stone-800">
                                              <span>{point.claim}</span>
                                              {point.needsVerification && (
                                                <Badge
                                                  variant="warning"
                                                  className="ml-1.5 text-[10px]"
                                                >
                                                  perlu verifikasi tambahan
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                          {point.sources && point.sources.length > 0 && (
                                            <div className="mt-2 ml-7 flex flex-wrap gap-1.5">
                                              {point.sources.map((s, si) => (
                                                <div
                                                  key={si}
                                                  className="inline-flex items-center gap-1.5 rounded-full border border-[#D9E1EC] bg-white px-2.5 py-0.5 text-[11px] text-stone-700 shadow-2xs"
                                                >
                                                  <Link
                                                    href={`/documents/${s.document_id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-medium hover:text-[#123B72] hover:underline"
                                                  >
                                                    {s.title || s.filename}
                                                  </Link>
                                                  {(s.article_url || s.source_url) && (
                                                    <a
                                                      href={s.source_url || s.article_url || "#"}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="inline-flex items-center gap-0.5 font-bold text-[#123B72] hover:underline"
                                                    >
                                                      {s.source === "ojs_portal" || s.source === "jp_insight_info"
                                                        ? "Portal"
                                                        : "OJS"}{" "}
                                                      <ExternalLink className="h-2.5 w-2.5" />
                                                    </a>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </li>
                                      ))}
                                    </ol>
                                  </TraceCardContent>
                                </TraceCard>
                              )}

                              {/* Referensi Naskah OJS Terbit (Collapsible Trace Card) */}
                              {!isKajian &&
                                !isUser &&
                                message.sources &&
                                message.sources.length > 0 && (
                                  <TraceCard defaultOpen={true}>
                                    <TraceCardHeader
                                      icon={<BookOpen className="h-4 w-4 text-[#123B72]" />}
                                      title={
                                        message.sources.some(
                                          (s) =>
                                            s.source === "ojs_portal" ||
                                            s.source === "jp_insight_info",
                                        )
                                          ? "Referensi Sumber Resmi"
                                          : "Referensi Jurnal Terbit OJS"
                                      }
                                      badge={
                                        <Badge
                                          variant="secondary"
                                          className="px-2 py-0.5 text-[10px]"
                                        >
                                          {message.sources.length}{" "}
                                          {message.sources.some(
                                            (s) =>
                                              s.source === "ojs_portal" ||
                                              s.source === "jp_insight_info",
                                          )
                                            ? "Sumber"
                                            : "Naskah"}
                                        </Badge>
                                      }
                                    />
                                    <TraceCardContent>
                                      <div className="flex flex-col gap-2">
                                        {message.sources.map((source, j) => {
                                          const authorText = formatAuthors(source.authors);
                                          const metaParts = [
                                            authorText || null,
                                            [
                                              source.volume ? `Vol. ${source.volume}` : null,
                                              source.issue_number
                                                ? `No. ${source.issue_number}`
                                                : null,
                                              source.published_year
                                                ? `(${source.published_year})`
                                                : null,
                                            ]
                                              .filter(Boolean)
                                              .join(" "),
                                            source.doi ? `DOI: ${source.doi}` : null,
                                          ]
                                            .filter(Boolean)
                                            .join(" · ");

                                          return (
                                            <div
                                              key={j}
                                              className="rounded-xl border-l-3 border-[#123B72] bg-[#F8FAFD] p-2.5 text-xs text-stone-700 transition-colors hover:bg-[#EEF4FC]/50"
                                            >
                                              <div className="flex items-start justify-between gap-2">
                                                <Link
                                                  href={`/documents/${source.document_id}`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="font-bold text-stone-900 hover:text-[#123B72] hover:underline"
                                                >
                                                  [{j + 1}] {source.title || source.filename}
                                                </Link>
                                                {(source.article_url || source.source_url) && (
                                                  <a
                                                    href={source.source_url || source.article_url || "#"}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-[#123B72] hover:underline"
                                                  >
                                                    {source.source === "ojs_portal" ||
                                                    source.source === "jp_insight_info"
                                                      ? "Portal"
                                                      : "OJS"}{" "}
                                                    <ExternalLink className="h-2.5 w-2.5" />
                                                  </a>
                                                )}
                                              </div>
                                              {metaParts && (
                                                <p className="mt-0.5 text-[11px] text-stone-500">
                                                  {metaParts}
                                                </p>
                                              )}
                                              {source.snippet && (
                                                <p className="mt-1 line-clamp-2 rounded-lg border border-[#E6ECF5] bg-white/70 p-1.5 text-[11px] leading-relaxed text-stone-600">
                                                  {source.snippet}
                                                </p>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </TraceCardContent>
                                  </TraceCard>
                                )}

                              {/* MessageFooter with timestamp & copy button */}
                              <MessageFooter align={isUser ? "end" : "start"}>
                                <span>{formatTime(message.timestamp)}</span>
                                {!isUser && (
                                  <>
                                    <span>·</span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyMessage(i, message.content)}
                                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-stone-500 hover:bg-[#EEF4FC] hover:text-[#123B72] transition-colors"
                                      title="Salin jawaban"
                                    >
                                      {copiedIndex === i ? (
                                        <>
                                          <Check className="h-3 w-3 text-emerald-600" />
                                          <span className="font-semibold text-emerald-700">
                                            Tersalin!
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="h-3 w-3" />
                                          <span>Salin</span>
                                        </>
                                      )}
                                    </button>
                                  </>
                                )}
                              </MessageFooter>
                            </MessageContent>
                          </Message>
                        </MessageScrollerItem>
                      );
                    })}

                    {chatLoading && (
                      <MessageScrollerItem messageId="loading-turn">
                        <Message align="start">
                          <MessageAvatar role="assistant" />
                          <MessageContent>
                            <Bubble variant="default">
                              <BubbleContent>
                                <div className="flex items-center gap-2.5 py-0.5 text-xs font-medium text-stone-600">
                                  <Loader2 className="h-4 w-4 animate-spin text-[#123B72]" />
                                  <span>AI sedang menganalisis korpus Jurnal Permukiman...</span>
                                </div>
                              </BubbleContent>
                            </Bubble>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    )}

                    {chatError && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                        {chatError}
                      </div>
                    )}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>
          </CardContent>

          {/* Card Footer: Integrated Prompt Input */}
          <CardFooter className="p-3 border-t border-[#E6ECF5] bg-white flex-col gap-2">
            <form onSubmit={handleSendChat} className="w-full">
              <PromptInput>
                <PromptInputTextarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onSubmit={() => {
                    if (!chatLoading && chatInput.trim()) {
                      handleSendChat();
                    }
                  }}
                  placeholder={
                    queryMode === "kajian"
                      ? "Tulis pertanyaan topik kajian ilmiah (mis: evaluasi bata interlocking untuk gempa)... Tekan Enter untuk mengirim."
                      : "Tanyakan apapun dari arsip naskah Jurnal Permukiman... Tekan Enter untuk mengirim."
                  }
                />
                <PromptInputActions>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Interactive Mode Toggle Pill */}
                    <div className="flex shrink-0 gap-0.5 rounded-full border border-[#D9E1EC] bg-[#F6F9FD] p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setQueryMode("chat")}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                          queryMode === "chat"
                            ? "bg-[#123B72] text-white shadow-xs"
                            : "text-stone-500 hover:text-[#0B254B]"
                        }`}
                      >
                        Chat
                      </button>
                      <button
                        type="button"
                        onClick={() => setQueryMode("kajian")}
                        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                          queryMode === "kajian"
                            ? "bg-[#EAB308] text-[#0B254B] shadow-xs"
                            : "text-stone-500 hover:text-[#0B254B]"
                        }`}
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>Kajian</span>
                      </button>
                    </div>

                    {(filterYear || filterTopics.length > 0) && (
                      <span className="text-[11px] font-medium text-stone-500">
                        Filter aktif: {[filterYear, ...filterTopics].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>
                  <PromptInputSubmit loading={chatLoading} disabled={!chatInput.trim()} />
                </PromptInputActions>
              </PromptInput>
            </form>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

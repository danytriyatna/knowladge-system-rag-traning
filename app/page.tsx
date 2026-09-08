"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SkillsPanel from "./components/SkillsPanel";

type ExtractionMethod = "local" | "gemini";
type PageTab = "upload" | "chat" | "skills";

interface DocumentSummary {
  id: string;
  filename: string;
  extraction_method: ExtractionMethod;
  page_count: number;
  uploaded_at: string;
}

interface ChatSource {
  document_id: string;
  filename: string;
  chunk_index: number;
  similarity: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  timestamp: string;
}

interface ChatHistoryItem {
  id: string;
  question: string;
  created_at: string;
}

const METHOD_LABEL: Record<ExtractionMethod, string> = {
  local: "Lokal",
  gemini: "Gemini",
};

export default function Home() {
  const [pageTab, setPageTab] = useState<PageTab>("upload");

  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [mode, setMode] = useState<ExtractionMethod>("local");
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
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
        body: JSON.stringify({ question }),
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
        },
      ]);
      setActiveHistoryId(data.id);
      setChatHistory((prev) => [
        { id: data.id, question, created_at: data.created_at },
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
        },
      ]);
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

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main
        className={`flex flex-1 w-full flex-col gap-6 py-16 px-6 ${
          pageTab === "chat" ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Upload &amp; Baca PDF
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Upload file PDF, sistem akan mengekstrak dan menyimpan isinya.
          </p>
        </div>

        <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setPageTab("upload")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              pageTab === "upload"
                ? "border-b-2 border-black text-black dark:border-white dark:text-white"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            Upload &amp; Dokumen
          </button>
          <button
            onClick={() => setPageTab("chat")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              pageTab === "chat"
                ? "border-b-2 border-black text-black dark:border-white dark:text-white"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            Chat AI
          </button>
          <button
            onClick={() => setPageTab("skills")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              pageTab === "skills"
                ? "border-b-2 border-black text-black dark:border-white dark:text-white"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            Skill
          </button>
        </div>

        {pageTab === "skills" && <SkillsPanel />}

        {pageTab === "upload" && (
          <div className="flex flex-col gap-8">
            <form
              onSubmit={handleUpload}
              className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="text-sm text-zinc-700 dark:text-zinc-300"
              />

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Mode pembacaan
                </span>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <input
                      type="radio"
                      name="mode"
                      value="local"
                      checked={mode === "local"}
                      onChange={() => setMode("local")}
                    />
                    Lokal (teks asli PDF)
                  </label>
                  <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
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
                  <p className="text-xs text-zinc-500">
                    Setiap halaman diproses sebagai gambar oleh AI, jadi bisa memakan waktu
                    1-3 menit (atau lebih) untuk dokumen banyak halaman. Mode Lokal jauh
                    lebih cepat kalau PDF-nya sudah berisi teks asli (bukan hasil scan).
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-fit rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
              >
                {loading
                  ? `Memproses... (${elapsedSeconds}s)`
                  : "Upload"}
              </button>
              {loading && mode === "gemini" && (
                <p className="text-xs text-zinc-500">
                  Sedang membaca dengan Gemini, mohon tunggu, jangan tutup halaman ini...
                </p>
              )}
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </form>

            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Dokumen ({documents.length})
              </h2>
              {documents.length === 0 && (
                <p className="text-sm text-zinc-500">Belum ada dokumen diupload.</p>
              )}
              <ul className="flex flex-col gap-2">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-black dark:text-zinc-50">
                        {doc.filename}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="rounded-full border border-zinc-200 px-2 py-0.5 dark:border-zinc-700">
                          {METHOD_LABEL[doc.extraction_method]}
                        </span>
                        {doc.page_count} halaman
                      </span>
                    </div>
                    <Link
                      href={`/documents/${doc.id}`}
                      className="shrink-0 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Detail &rarr;
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {pageTab === "chat" && (
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex shrink-0 flex-col gap-2 md:w-56">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Riwayat
                </h2>
                <button
                  onClick={handleNewChat}
                  className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  + Baru
                </button>
              </div>
              {chatHistory.length === 0 && (
                <p className="text-xs text-zinc-500">Belum ada riwayat percakapan.</p>
              )}
              <ul className="flex flex-col gap-1 md:max-h-[500px] md:overflow-y-auto">
                {chatHistory.map((item) => (
                  <li key={item.id} className="flex items-center gap-1">
                    <button
                      onClick={() => handleSelectHistory(item.id)}
                      className={`min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                        activeHistoryId === item.id
                          ? "bg-zinc-200 text-black dark:bg-zinc-800 dark:text-white"
                          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                      }`}
                    >
                      {historyLoadingId === item.id ? "Memuat..." : item.question}
                    </button>
                    <button
                      onClick={(e) => handleDeleteHistory(e, item.id)}
                      title="Hapus riwayat"
                      aria-label="Hapus riwayat"
                      className="shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                    >
                      &#10005;
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-1 flex-col gap-4">
              <p className="text-sm text-zinc-500">
                Tanyakan apa saja dari seluruh dokumen yang sudah di-embed. Jawaban disusun
                AI hanya berdasarkan isi dokumen kamu.
              </p>

              <div className="flex max-h-[65vh] min-h-[300px] flex-col gap-1.5 overflow-y-auto rounded-lg border border-zinc-200 bg-[#e9e4da] p-4 dark:border-zinc-800 dark:bg-[#0b141a]">
                {chatMessages.length === 0 && (
                  <p className="m-auto text-sm text-zinc-500">
                    Belum ada percakapan. Coba tanyakan sesuatu tentang dokumenmu di bawah,
                    atau klik salah satu riwayat di samping.
                  </p>
                )}
                {chatMessages.map((message, i) => (
                  <div
                    key={i}
                    className={`flex flex-col gap-1 ${
                      message.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6 shadow-sm ${
                        message.role === "user"
                          ? "rounded-br-sm bg-[#d9fdd3] text-zinc-900 dark:bg-[#005c4b] dark:text-zinc-50"
                          : "rounded-bl-sm bg-white text-zinc-800 dark:bg-[#202c33] dark:text-zinc-100"
                      }`}
                    >
                      {message.content}
                      <span className="mt-1 block text-right text-[10px] leading-none text-zinc-500 dark:text-zinc-400">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                    {message.role === "assistant" &&
                      message.sources &&
                      message.sources.length > 0 && (
                        <div className="flex max-w-[75%] flex-wrap gap-1.5">
                          {message.sources.map((source, j) => (
                            <Link
                              key={j}
                              href={`/documents/${source.document_id}`}
                              className="rounded-full border border-zinc-300 bg-white/80 px-2 py-0.5 text-xs text-zinc-600 hover:border-blue-400 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:text-blue-400"
                            >
                              {source.filename} &middot; bagian {source.chunk_index + 1}
                            </Link>
                          ))}
                        </div>
                      )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-start">
                    <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-zinc-500 shadow-sm dark:bg-[#202c33] dark:text-zinc-400">
                      AI sedang berpikir...
                    </div>
                  </div>
                )}
                {chatError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{chatError}</p>
                )}
                <div ref={chatEndRef} />
              </div>

            <form onSubmit={handleSendChat} className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Tanyakan sesuatu dari dokumenmu..."
                className="flex-1 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="shrink-0 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
              >
                Kirim
              </button>
            </form>
          </div>
          </div>
        )}
      </main>
    </div>
  );
}

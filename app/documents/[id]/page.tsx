"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ExtractionMethod = "local" | "gemini";

interface DocumentDetail {
  id: string;
  filename: string;
  extracted_text: string;
  extraction_method: ExtractionMethod;
  page_count: number;
  uploaded_at: string;
}

const METHOD_LABEL: Record<ExtractionMethod, string> = {
  local: "Lokal",
  gemini: "Gemini",
};

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/documents/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Gagal memuat dokumen");
        setDocument(data.document);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat dokumen"));
  }, [id]);

  async function handleDelete() {
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    router.push("/");
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-2xl flex-col gap-6 py-16 px-6">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          &larr; Kembali
        </Link>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {document && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
                  {document.filename}
                </h1>
                <p className="flex items-center gap-2 text-sm text-zinc-500">
                  <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs dark:border-zinc-700">
                    {METHOD_LABEL[document.extraction_method]}
                  </span>
                  {document.page_count} halaman &middot;{" "}
                  {new Date(document.uploaded_at).toLocaleString("id-ID")}
                </p>
              </div>
              <button
                onClick={handleDelete}
                className="shrink-0 rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                Hapus
              </button>
            </div>
            <pre className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
              {document.extracted_text || "(Tidak ada teks yang bisa diekstrak dari PDF ini)"}
            </pre>
          </>
        )}
      </main>
    </div>
  );
}

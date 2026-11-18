/**
 * Pagar sitasi — menegakkan satu syarat mutlak sistem ini: tidak ada jawaban
 * tanpa sumber.
 *
 * Sebelumnya syarat itu hanya diimbau lewat prompt, sehingga bergantung pada
 * kepatuhan model. Di sini ia jadi jaminan kode.
 */

/** Jawaban baku ketika tidak ada satu pun sumber yang bisa menopang jawaban. */
export const NO_SOURCE_ANSWER =
  "Informasi yang diminta tidak ditemukan pada artikel terbitan, halaman resmi Jurnal Permukiman, maupun dokumentasi JP-Insight yang tersedia.";

/**
 * Buang nomor sumber yang tidak menunjuk konteks mana pun.
 *
 * Model kadang mengarang indeks sitasi (menyebut [Sumber 12] padahal konteks
 * hanya berisi 8), atau mengembalikan nilai non-integer. Sitasi seperti itu
 * tidak bisa diverifikasi siapa pun dan harus gugur sebelum dipakai.
 */
export function validSourceNumbers(
  numbers: number[],
  chunkCount: number
): number[] {
  return Array.from(new Set(numbers)).filter(
    (n) => Number.isInteger(n) && n >= 1 && n <= chunkCount
  );
}

export interface DeduplicableCitation {
  document_id?: string | null;
  chunk_index?: number | null;
  similarity?: number | null;
  source_url?: string | null;
  article_url?: string | null;
  filename?: string | null;
  title?: string | null;
}

export interface ChunkCitationInput {
  document_id: string;
  filename: string;
  chunk_index: number;
  content: string;
  similarity: number;
  title?: string | null;
  authors?: string | null;
  published_year?: number | null;
  volume?: string | null;
  issue_number?: string | null;
  doi?: string | null;
  ojs_article_id?: number | null;
  source?: string | null;
  source_url?: string | null;
}

export interface ChatSourceCitation {
  document_id: string;
  filename: string;
  chunk_index: number;
  similarity: number;
  title: string;
  authors: string;
  published_year: number | null;
  volume: string | null;
  issue_number: string | null;
  doi: string | null;
  ojs_article_id: number | null;
  article_url: string | null;
  source: "ojs_harvest" | "ojs_portal" | "jp_insight_info" | "manual_upload";
  source_url: string | null;
  snippet: string;
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1");
}

function trimOverlapFragment(text: string, chunkIndex: number): string {
  if (chunkIndex <= 0 || !text) return text;

  const head = text.slice(0, Math.min(220, text.length));
  const candidates: number[] = [];

  const newlineIdx = head.search(/\r?\n/);
  if (newlineIdx >= 0) {
    const afterNl = text.slice(newlineIdx).replace(/^\s+/, "");
    if (afterNl.length >= 80) candidates.push(text.length - afterNl.length);
  }

  const sentenceMatch = head.match(/[.!?]\s+/);
  if (sentenceMatch && sentenceMatch.index !== undefined) {
    const offset = sentenceMatch.index + sentenceMatch[0].length;
    if (text.length - offset >= 80) candidates.push(offset);
  }

  if (candidates.length > 0) {
    const earliest = Math.min(...candidates);
    return text.slice(earliest).trimStart();
  }

  // Fallback jika chunk berpotongan tepat di tengah kata pendek/tanda tutup tanpa pemisah kalimat
  const clippedStart = text.match(/^([),.;:\]]+|[a-z])\s+/);
  if (clippedStart && text.length - clippedStart[0].length >= 80) {
    return text.slice(clippedStart[0].length).trimStart();
  }

  return text;
}

/**
 * Merapikan cuplikan (snippet) dari chunk agar bebas penanda heading Markdown
 * (#, ##), potongan kata overlap di awal chunk lanjutan, serta terpotong
 * di batas kata yang utuh.
 */
export function formatCitationSnippet(
  rawContent: string,
  maxLength = 200,
  chunkIndex = 0
): string {
  const normalized = String(rawContent || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  const startAligned = trimOverlapFragment(normalized, chunkIndex);
  const lines = startAligned.split("\n");
  const segments: Array<{ text: string; isHeading: boolean }> = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const headingText = stripInlineMarkdown(headingMatch[1].trim());
      if (headingText) {
        const formattedHeading = /[.!?:;—-]$/.test(headingText)
          ? headingText
          : `${headingText} —`;
        segments.push({ text: formattedHeading, isHeading: true });
      }
      continue;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    const cleanedLine = stripInlineMarkdown(
      bulletMatch ? bulletMatch[1].trim() : line
    );
    if (cleanedLine) {
      segments.push({ text: cleanedLine, isHeading: false });
    }
  }

  let flat = "";
  let prevWasHeading = false;
  for (const seg of segments) {
    if (!flat) {
      flat = seg.text;
    } else if (prevWasHeading || /[.!?:;—-]$/.test(flat)) {
      flat += ` ${seg.text}`;
    } else {
      flat += `. ${seg.text}`;
    }
    prevWasHeading = seg.isHeading;
  }

  flat = flat.replace(/\s+/g, " ").trim();
  if (flat.length <= maxLength) return flat;

  const slice = flat.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(" ");
  const boundary = lastSpace >= Math.floor(maxLength * 0.6) ? slice.slice(0, lastSpace) : slice;
  return `${boundary.replace(/[,;:\s-]+$/, "")}...`;
}

/**
 * Mengubah chunk hasil pencarian menjadi payload sitasi standar untuk mode Chat
 * dan Widget publik dengan snippet yang sudah dirapikan.
 */
export function buildChatSourceCitation(
  chunk: ChunkCitationInput,
  ojsArticleBaseUrl: string,
  jpInsightBaseUrl = ""
): ChatSourceCitation {
  const validSource =
    chunk.source === "manual_upload" ||
    chunk.source === "ojs_portal" ||
    chunk.source === "jp_insight_info"
      ? chunk.source
      : "ojs_harvest";

  const cleanInsightBase = jpInsightBaseUrl.trim().replace(/\/+$/, "");
  const fallbackInfoUrl = cleanInsightBase ? `${cleanInsightBase}/panduan` : "/panduan";
  const resolvedSourceUrl =
    chunk.source_url ??
    (validSource === "jp_insight_info" ? fallbackInfoUrl : null);

  return {
    document_id: chunk.document_id,
    filename: chunk.filename,
    chunk_index: chunk.chunk_index,
    similarity: chunk.similarity,
    title: chunk.title || chunk.filename,
    authors: chunk.authors || "",
    published_year: chunk.published_year ?? null,
    volume: chunk.volume ?? null,
    issue_number: chunk.issue_number ?? null,
    doi: chunk.doi ?? null,
    ojs_article_id: chunk.ojs_article_id ?? null,
    article_url: chunk.ojs_article_id
      ? `${ojsArticleBaseUrl}/${chunk.ojs_article_id}`
      : null,
    source: validSource,
    source_url: resolvedSourceUrl,
    snippet: formatCitationSnippet(chunk.content, 200, chunk.chunk_index),
  };
}

/**
 * Menggabungkan sitasi yang berasal dari dokumen yang sama (`document_id`) agar
 * satu dokumen tidak tampil berulang kali sebagai beberapa kartu referensi.
 * Chunk dengan skor kemiripan tertinggi dipertahankan sebagai cuplikan utama.
 */
export function dedupeCitationsByDocument<T extends DeduplicableCitation>(
  citations: T[]
): T[] {
  const result: T[] = [];
  const indexByKey = new Map<string, number>();

  for (let i = 0; i < citations.length; i++) {
    const item = citations[i];
    if (!item || typeof item !== "object") continue;

    const docId = typeof item.document_id === "string" ? item.document_id.trim() : "";
    const sourceUrl = typeof item.source_url === "string" ? item.source_url.trim() : "";
    const articleUrl = typeof item.article_url === "string" ? item.article_url.trim() : "";
    const title = typeof item.title === "string" ? item.title.trim().toLowerCase() : "";
    const filename = typeof item.filename === "string" ? item.filename.trim().toLowerCase() : "";

    const key = docId
      ? `doc:${docId}`
      : sourceUrl
        ? `url:${sourceUrl}`
        : articleUrl
          ? `url:${articleUrl}`
          : title
            ? `title:${title}`
            : filename
              ? `file:${filename}`
              : `idx:${i}`;

    const existingIdx = indexByKey.get(key);
    if (existingIdx === undefined) {
      indexByKey.set(key, result.length);
      result.push(item);
      continue;
    }

    const existing = result[existingIdx];
    const candidateSim = typeof item.similarity === "number" ? item.similarity : -1;
    const existingSim = typeof existing.similarity === "number" ? existing.similarity : -1;
    const candidateChunk = typeof item.chunk_index === "number" ? item.chunk_index : Number.MAX_SAFE_INTEGER;
    const existingChunk = typeof existing.chunk_index === "number" ? existing.chunk_index : Number.MAX_SAFE_INTEGER;

    if (
      candidateSim > existingSim ||
      (candidateSim === existingSim && candidateChunk < existingChunk)
    ) {
      result[existingIdx] = item;
    }
  }

  return result;
}

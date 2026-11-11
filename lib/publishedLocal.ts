import fs from "node:fs";
import path from "node:path";
import { NO_SOURCE_ANSWER } from "./citation";

export interface PublishedOjsArticle {
  id: string;
  ojs_article_id: number;
  source: "ojs_harvest";
  title: string;
  abstract: string;
  authors: string[];
  volume: string | null;
  issue_number: string | null;
  published_year: number | null;
  doi: string | null;
  topics: string[];
  article_url: string;
}

export interface PublishedSourceCitation {
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
  source: "ojs_harvest" | "manual_upload";
  snippet?: string;
}

export interface PublishedSearchFilters {
  year?: number;
  topics?: string[];
}

export interface PublishedKajianPoint {
  claim: string;
  sources: Array<{
    document_id: string;
    filename: string;
    chunk_index: number;
    title?: string;
    article_url?: string | null;
  }>;
  needsVerification: boolean;
}

const STOPWORDS = new Set([
  "apa", "apakah", "apaan", "bagaimana", "gimana", "mengapa", "kenapa", "siapa",
  "dimana", "kapan", "berapa", "mana", "yang", "dan", "atau", "di", "ke", "dari",
  "pada", "untuk", "dengan", "dalam", "adalah", "ialah", "merupakan", "itu", "ini",
  "tersebut", "sebagai", "oleh", "karena", "jika", "bila", "agar", "supaya", "tentang",
  "mengenai", "seperti", "antara", "sudah", "telah", "akan", "bisa", "dapat", "harus",
  "perlu", "tidak", "tak", "bukan", "belum", "juga", "serta", "saja", "lagi", "lebih",
  "sangat", "secara", "terhadap", "atas", "bawah", "tolong", "jelaskan", "sebutkan",
  "carikan", "cari", "kasih", "tahu", "dong", "sih", "deh", "nih", "ya", "yuk",
  "jurnal", "artikel", "dokumen", "makalah", "paper", "penelitian", "kajian", "studi",
  "data", "info", "informasi", "hasil", "bahas", "membahas", "terkait", "soal",
  "kesimpulan", "ringkasan", "rangkuman", "intinya", "poin", "abstrak", "referensi", "daftar",
  "the", "and", "for", "with", "from", "that", "this", "what", "how", "why", "who",
  "where", "when", "which", "is", "are", "was", "were", "in", "of", "to", "on", "by",
  "about", "please", "explain", "tell",
]);

let cachedArticles: PublishedOjsArticle[] | null = null;

export function loadPublishedOjsArticles(): PublishedOjsArticle[] {
  if (cachedArticles) return cachedArticles;
  try {
    const filePath = path.join(process.cwd(), "data", "published_ojs_articles.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as PublishedOjsArticle[];
    cachedArticles = parsed.filter((a) => a.source === "ojs_harvest" && Boolean(a.title));
    return cachedArticles;
  } catch {
    return [];
  }
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractQueryTokens(question: string): string[] {
  const norm = normalizeText(question);
  if (!norm) return [];
  const rawTokens = norm.split(" ").filter(Boolean);
  const filtered = rawTokens.filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return Array.from(new Set(filtered));
}

function buildArticleSearchText(article: PublishedOjsArticle) {
  const titleNorm = normalizeText(article.title);
  const abstractNorm = normalizeText(article.abstract);
  const authorsNorm = normalizeText(article.authors.join(" "));
  const topicsNorm = normalizeText(article.topics.join(" "));
  return {
    titleNorm,
    abstractNorm,
    authorsNorm,
    topicsNorm,
    combined: `${titleNorm} ${abstractNorm} ${authorsNorm} ${topicsNorm}`,
  };
}

function scoreArticle(
  article: PublishedOjsArticle,
  tokens: string[],
  rawPhrase: string,
): { score: number; matchedCount: number } {
  if (!article.abstract || article.abstract.length < 25) {
    return { score: 0, matchedCount: 0 };
  }

  const hay = buildArticleSearchText(article);
  let matchedCount = 0;
  let score = 0;

  for (const token of tokens) {
    const tokenRx = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    const inTitle = tokenRx.test(hay.titleNorm);
    const inAbstract = tokenRx.test(hay.abstractNorm);
    const inAuthors = tokenRx.test(hay.authorsNorm);
    const inTopics = tokenRx.test(hay.topicsNorm);

    if (inTitle || inAbstract || inAuthors || inTopics) {
      matchedCount += 1;
      if (inTitle) score += 0.35;
      if (inAbstract) score += 0.22;
      if (inTopics) score += 0.12;
      if (inAuthors) score += 0.1;
    }
  }

  if (rawPhrase.length >= 6 && hay.combined.includes(rawPhrase)) {
    score += 0.35;
  }

  const coverage = tokens.length > 0 ? matchedCount / tokens.length : 0;
  return { score: Math.min(0.99, Number((score * 0.4 + coverage * 0.6).toFixed(4))), matchedCount };
}

function extractRelevantExcerpt(article: PublishedOjsArticle, tokens: string[], maxLen = 240): string {
  const abstract = article.abstract.trim();
  if (!abstract) return article.title;
  const sentences = abstract
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  if (sentences.length === 0) {
    return abstract.slice(0, maxLen) + (abstract.length > maxLen ? "..." : "");
  }

  const ranked = sentences
    .map((sentence, idx) => {
      const lower = sentence.toLowerCase();
      const hits = tokens.reduce((acc, tok) => acc + (lower.includes(tok) ? 1 : 0), 0);
      return { sentence, hits, idx };
    })
    .sort((a, b) => b.hits - a.hits || a.idx - b.idx);

  const chosen = ranked.slice(0, 2).map((r) => r.sentence).join(" ");
  return chosen.length > maxLen ? `${chosen.slice(0, maxLen - 3).trim()}...` : chosen;
}

function toFilename(article: PublishedOjsArticle): string {
  const year = article.published_year ?? "OJS";
  const vol = article.volume ? `Vol.${article.volume}` : "";
  const no = article.issue_number ? `No.${article.issue_number}` : "";
  const volInfo = [vol, no].filter(Boolean).join("/");
  return `JP ${year}${volInfo ? ` (${volInfo})` : ""} - ${article.title.slice(0, 72)}${article.title.length > 72 ? "..." : ""}`;
}

function filterArticles(articles: PublishedOjsArticle[], filters?: PublishedSearchFilters) {
  return articles.filter((a) => {
    if (filters?.year && a.published_year !== filters.year) return false;
    if (filters?.topics && filters.topics.length > 0) {
      const hay = `${a.title} ${a.abstract} ${a.topics.join(" ")}`.toLowerCase();
      const anyTopic = filters.topics.some((t) => hay.includes(t.toLowerCase()));
      if (!anyTopic) return false;
    }
    return true;
  });
}

export function searchPublishedOjsCorpus(
  question: string,
  options?: {
    filters?: PublishedSearchFilters;
    limit?: number;
    mode?: "chat" | "kajian";
  },
): {
  grounded: boolean;
  answer: string;
  sources: PublishedSourceCitation[];
  mode: "chat" | "kajian";
  evidenceStrength?: "kuat" | "sedang" | "lemah";
  points?: PublishedKajianPoint[];
} {
  const mode = options?.mode === "kajian" ? "kajian" : "chat";
  const limit = options?.limit ?? 4;
  const tokens = extractQueryTokens(question);

  // Guardrail 1: If no meaningful content tokens exist, reject cleanly with zero references.
  if (tokens.length === 0) {
    return {
      grounded: false,
      answer: NO_SOURCE_ANSWER,
      sources: [],
      mode,
    };
  }

  const allArticles = filterArticles(loadPublishedOjsArticles(), options?.filters);
  const rawPhrase = tokens.join(" ");
  const minRequiredMatched = tokens.length === 1 ? 1 : Math.max(2, Math.ceil(tokens.length * 0.5));

  const scored = allArticles
    .map((article) => {
      const { score, matchedCount } = scoreArticle(article, tokens, rawPhrase);
      return { article, score, matchedCount };
    })
    .filter((item) => {
      if (item.matchedCount < minRequiredMatched) return false;
      if (tokens.length === 1) {
        const single = tokens[0];
        const titleHit = normalizeText(item.article.title).includes(single);
        const absHits = (normalizeText(item.article.abstract).match(new RegExp(`\\b${single}`, "g")) ?? []).length;
        return titleHit || absHits >= 2;
      }
      return item.score >= 0.42;
    })
    .sort((a, b) => b.score - a.score || (b.article.published_year ?? 0) - (a.article.published_year ?? 0))
    .slice(0, limit);

  // Guardrail 2: Out-of-scope query -> zero output references & strict refusal message.
  if (scored.length === 0) {
    return {
      grounded: false,
      answer: NO_SOURCE_ANSWER,
      sources: [],
      mode,
    };
  }

  const sources: PublishedSourceCitation[] = scored.map((item) => ({
    document_id: item.article.id,
    filename: toFilename(item.article),
    chunk_index: 0,
    similarity: item.score,
    title: item.article.title,
    authors: item.article.authors.join(", ") || "Tim Penulis Jurnal Permukiman",
    published_year: item.article.published_year,
    volume: item.article.volume,
    issue_number: item.article.issue_number,
    doi: item.article.doi,
    ojs_article_id: item.article.ojs_article_id,
    article_url: item.article.article_url,
    source: "ojs_harvest",
    snippet: extractRelevantExcerpt(item.article, tokens, 220),
  }));

  if (mode === "kajian") {
    const points: PublishedKajianPoint[] = scored.map((item) => ({
      claim: extractRelevantExcerpt(item.article, tokens, 260),
      sources: [
        {
          document_id: item.article.id,
          filename: item.article.title,
          chunk_index: 0,
          title: item.article.title,
          article_url: item.article.article_url,
        },
      ],
      needsVerification: item.score < 0.65,
    }));

    const evidenceStrength: "kuat" | "sedang" | "lemah" =
      scored.length >= 3 && scored[0].score >= 0.68
        ? "kuat"
        : scored.length >= 2 || scored[0].score >= 0.55
          ? "sedang"
          : "lemah";

    const intro = `Berdasarkan ${scored.length} artikel Jurnal Permukiman yang telah terbit dan relevan dengan topik tersebut:`;
    return {
      grounded: true,
      answer: intro,
      sources,
      mode: "kajian",
      evidenceStrength,
      points,
    };
  }

  const summaryLines = scored.map((item, idx) => {
    const excerpt = extractRelevantExcerpt(item.article, tokens, 240);
    const volNo = [
      item.article.volume ? `Vol. ${item.article.volume}` : null,
      item.article.issue_number ? `No. ${item.article.issue_number}` : null,
      item.article.published_year ? `(${item.article.published_year})` : null,
    ]
      .filter(Boolean)
      .join(" ");
    return `[${idx + 1}] ${item.article.title}${volNo ? ` — ${volNo}` : ""}: ${excerpt}`;
  });

  const answer = `Berdasarkan arsip Jurnal Permukiman yang sudah dipublikasikan:\n\n${summaryLines.join("\n\n")}`;

  return {
    grounded: true,
    answer,
    sources,
    mode: "chat",
  };
}

export function listPublishedDocumentSummaries(options?: {
  source?: string | null;
  year?: number | null;
  search?: string | null;
  limit?: number;
}) {
  if (options?.source === "manual_upload") {
    return [];
  }
  const all = loadPublishedOjsArticles();
  const filtered = all.filter((a) => {
    if (options?.year && a.published_year !== options.year) return false;
    if (options?.search) {
      const q = options.search.toLowerCase();
      const hay = `${a.title} ${a.abstract} ${a.authors.join(" ")} ${a.doi ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sliced = options?.limit ? filtered.slice(0, options.limit) : filtered;
  return sliced.map((a) => ({
    id: a.id,
    filename: a.title,
    extraction_method: "local" as const,
    page_count: 1,
    uploaded_at: `${a.published_year ?? 2022}-06-01T00:00:00.000Z`,
    title: a.title,
    authors: JSON.stringify(a.authors),
    doi: a.doi ?? "",
    published_year: a.published_year,
    volume: a.volume ?? "",
    issue_number: a.issue_number ?? "",
    topics: JSON.stringify(a.topics),
    source: "ojs_harvest" as const,
    ojs_article_id: a.ojs_article_id,
    article_url: a.article_url,
    chunk_count: a.abstract ? 1 : 0,
    embedding_count: a.abstract ? 1 : 0,
  }));
}

export function getPublishedDocumentById(id: string) {
  const match = loadPublishedOjsArticles().find((a) => a.id === id);
  if (!match) return null;
  const volInfo = [
    match.volume ? `Volume ${match.volume}` : null,
    match.issue_number ? `Nomor ${match.issue_number}` : null,
    match.published_year ? `Tahun ${match.published_year}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const extractedText = [
    `Judul: ${match.title}`,
    `Penulis: ${match.authors.join(", ") || "-"}`,
    `Publikasi: Jurnal Permukiman — ${volInfo || "OJS"}`,
    match.doi ? `DOI: https://doi.org/${match.doi}` : null,
    `Tautan Artikel Terbit OJS: ${match.article_url}`,
    "",
    "Abstrak:",
    match.abstract || "(Artikel pengantar redaksi / tanpa teks abstrak di database OJS.)",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    id: match.id,
    filename: match.title,
    extracted_text: extractedText,
    extraction_method: "local" as const,
    page_count: 1,
    uploaded_at: `${match.published_year ?? 2022}-06-01T00:00:00.000Z`,
    title: match.title,
    authors: match.authors.join(", "),
    doi: match.doi ?? "",
    published_year: match.published_year,
    volume: match.volume,
    issue_number: match.issue_number,
    ojs_article_id: match.ojs_article_id,
    article_url: match.article_url,
    source: "ojs_harvest" as const,
  };
}

import { XMLParser } from "fast-xml-parser";

const OAI_BASE_URL =
  process.env.OJS_OAI_URL ?? "https://jurnalpermukiman.pu.go.id/index.php/JP/oai";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

export interface OaiArticle {
  ojsArticleId: string;
  title: string;
  authors: string[];
  abstract: string;
  doi: string;
  publishedYear: number | null;
  volume: string;
  issueNumber: string;
  topics: string[];
  articleViewUrl: string;
  pdfDownloadUrl: string | null;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "#text" in value) {
    return String((value as { "#text": unknown })["#text"] ?? "");
  }
  return "";
}

/**
 * OJS article "view" links look like /article/view/{id}/{galleyId}. Swapping
 * "view" for "download" returns the raw PDF directly — no HTML scraping needed.
 */
function toDownloadUrl(viewUrl: string): string | null {
  if (!viewUrl.includes("/article/view/")) return null;
  const url = viewUrl.replace("/article/view/", "/article/download/");
  return url.startsWith("http") ? url : `https:${url}`;
}

function parseRecord(record: Record<string, unknown>): OaiArticle | null {
  const header = record.header as Record<string, unknown> | undefined;
  if (header && "@_status" in header && header["@_status"] === "deleted") {
    return null;
  }

  const dc = (record.metadata as Record<string, unknown> | undefined)?.[
    "oai_dc:dc"
  ] as Record<string, unknown> | undefined;
  if (!dc) return null;

  const identifiers = toArray(dc["dc:identifier"] as unknown).map(textOf);
  const articleViewUrl = identifiers.find((id) => id.includes("/article/view/")) ?? "";
  const ojsArticleIdMatch = articleViewUrl.match(/\/article\/view\/(\d+)/);
  const ojsArticleId = ojsArticleIdMatch?.[1] ?? "";
  const doi =
    identifiers.find((id) => /^10\.\d{4,9}\//.test(id.replace(/^https?:\/\/(dx\.)?doi\.org\//, ""))) ??
    "";

  const relations = toArray(dc["dc:relation"] as unknown).map(textOf);
  const pdfViewUrl = relations.find((r) => r.includes("/article/view/")) ?? "";

  const sources = toArray(dc["dc:source"] as unknown).map(textOf);
  const journalSource = sources.find((s) => /Vol/i.test(s)) ?? "";
  const volumeMatch = journalSource.match(/Vol\.?\s*(\d+)/i);
  const issueMatch = journalSource.match(/No\.?\s*(\d+)/i);
  const yearMatch = journalSource.match(/\((\d{4})\)/);

  const title = textOf(dc["dc:title"]);
  if (!title || !ojsArticleId) return null;

  return {
    ojsArticleId,
    title,
    authors: toArray(dc["dc:creator"] as unknown).map(textOf).filter(Boolean),
    abstract: textOf(dc["dc:description"]),
    doi,
    publishedYear: yearMatch ? Number(yearMatch[1]) : null,
    volume: volumeMatch?.[1] ?? "",
    issueNumber: issueMatch?.[1] ?? "",
    topics: toArray(dc["dc:subject"] as unknown).map(textOf).filter(Boolean),
    articleViewUrl,
    pdfDownloadUrl: toDownloadUrl(pdfViewUrl),
  };
}

interface ListRecordsPage {
  articles: OaiArticle[];
  resumptionToken: string | null;
}

export async function fetchOaiPage(resumptionToken?: string): Promise<ListRecordsPage> {
  const url = new URL(OAI_BASE_URL);
  url.searchParams.set("verb", "ListRecords");
  if (resumptionToken) {
    url.searchParams.set("resumptionToken", resumptionToken);
  } else {
    url.searchParams.set("metadataPrefix", "oai_dc");
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`OAI-PMH request gagal: HTTP ${res.status}`);
  }
  const xml = await res.text();
  const parsed = parser.parse(xml);

  const oaiError = parsed?.["OAI-PMH"]?.error;
  if (oaiError) {
    const message = typeof oaiError === "string" ? oaiError : textOf(oaiError);
    throw new Error(`OAI-PMH error: ${message || "unknown"}`);
  }

  const listRecords = parsed?.["OAI-PMH"]?.ListRecords;
  const records = toArray(listRecords?.record as Record<string, unknown> | Record<string, unknown>[]);
  const articles = records
    .map((r) => parseRecord(r))
    .filter((a): a is OaiArticle => a !== null);

  const tokenNode = listRecords?.resumptionToken;
  const token = tokenNode ? textOf(tokenNode).trim() : "";

  return { articles, resumptionToken: token || null };
}

/** Fetch every page from OAI-PMH, following resumptionToken until exhausted. */
export async function fetchAllOaiArticles(
  onPage?: (articles: OaiArticle[]) => void
): Promise<OaiArticle[]> {
  const all: OaiArticle[] = [];
  let token: string | undefined;

  do {
    const page = await fetchOaiPage(token);
    all.push(...page.articles);
    onPage?.(page.articles);
    token = page.resumptionToken ?? undefined;
  } while (token);

  return all;
}

export type GalleyFileKind = "pdf" | "docx" | "unknown";

export interface DownloadedGalley {
  buffer: Buffer;
  kind: GalleyFileKind;
}

/**
 * Unduh berkas galley dan tentukan jenisnya dari ISI berkas (magic bytes),
 * bukan dari header Content-Type — beberapa respons server OJS ini tidak
 * menyertakan Content-Type sama sekali meski berkasnya PDF yang valid.
 */
export async function downloadGalleyFile(url: string): Promise<DownloadedGalley> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Gagal mengunduh berkas: HTTP ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") {
    return { buffer, kind: "pdf" };
  }
  // .docx (dan format OOXML lain) adalah arsip ZIP, ditandai signature "PK".
  if (buffer.subarray(0, 2).toString("latin1") === "PK") {
    return { buffer, kind: "docx" };
  }
  return { buffer, kind: "unknown" };
}

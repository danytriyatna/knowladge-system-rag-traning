import { createHash } from "node:crypto";

export interface OjsPortalPageSpec {
  slug: string;
  title: string;
  topics: string[];
}

/**
 * Daftar whitelist halaman informasi & kebijakan resmi portal OJS Jurnal Permukiman.
 * Hanya URL dari portal resmi ini yang disinkronkan agar scope pengetahuan tetap terkendali.
 */
export const OJS_PORTAL_PAGES: OjsPortalPageSpec[] = [
  { slug: "about", title: "About the Journal & Journal History — Jurnal Permukiman", topics: ["Profil Jurnal", "Tentang Jurnal"] },
  { slug: "about/submissions", title: "Submissions, Author Guidelines, & Copyright Notice — Jurnal Permukiman", topics: ["Panduan Penulis", "Submit Naskah"] },
  { slug: "fokus", title: "Aims and Scope (Fokus dan Ruang Lingkup) — Jurnal Permukiman", topics: ["Fokus dan Scope", "Bidang Kajian"] },
  { slug: "about/editorialTeam", title: "Editorial Team (Dewan Redaksi) — Jurnal Permukiman", topics: ["Dewan Redaksi", "Editor"] },
  { slug: "ArticleProcessingCharge", title: "Article Processing Charge (APC / Biaya Publikasi) — Jurnal Permukiman", topics: ["Biaya Publikasi", "APC"] },
  { slug: "copyrightnoticeandlicensing", title: "Copyright Notice and Licensing — Jurnal Permukiman", topics: ["Hak Cipta", "Lisensi"] },
  { slug: "AIPolicy", title: "Generative AI Policy — Jurnal Permukiman", topics: ["Kebijakan AI", "Etika Penulisan"] },
  { slug: "publicationEthics", title: "Publication Ethics — Jurnal Permukiman", topics: ["Etika Publikasi"] },
  { slug: "PlagiarismCheck", title: "Plagiarism Check Policy — Jurnal Permukiman", topics: ["Cek Plagiarisme"] },
  { slug: "ArticleRetractionWithdrawal", title: "Article Retraction and Withdrawal — Jurnal Permukiman", topics: ["Retraksi", "Penarikan Naskah"] },
  { slug: "ComplaintsandAppealsPolicy", title: "Complaints and Appeals Policy — Jurnal Permukiman", topics: ["Keluhan", "Banding"] },
  { slug: "PostPublicationDiscussion", title: "Post-Publication Discussion Policy — Jurnal Permukiman", topics: ["Diskusi Pasca Terbit"] },
  { slug: "kebijakanreview", title: "Peer Review Process — Jurnal Permukiman", topics: ["Proses Review", "Penelaahan"] },
  { slug: "PeerReview", title: "Peer Reviewers — Jurnal Permukiman", topics: ["Mitra Bestari", "Reviewer"] },
  { slug: "indexing", title: "Abstracting and Indexing — Jurnal Permukiman", topics: ["Indeksasi", "SINTA", "Akreditasi"] },
  { slug: "OpenAccessPolicy", title: "Open Access Policy — Jurnal Permukiman", topics: ["Akses Terbuka", "Open Access"] },
  { slug: "PublicationFrequency", title: "Publication Frequency (Frekuensi Terbit) — Jurnal Permukiman", topics: ["Jadwal Terbit", "Frekuensi Terbit"] },
  { slug: "ArchivingPolicy", title: "Archiving Policy — Jurnal Permukiman", topics: ["Pengarsipan"] },
  { slug: "announcement", title: "Announcements (Pengumuman Resmi) — Jurnal Permukiman", topics: ["Pengumuman"] },
  { slug: "user/register", title: "Registration (Panduan Pendaftaran Akun OJS) — Jurnal Permukiman", topics: ["Registrasi", "Daftar Akun"] },
  { slug: "about/contact", title: "Contact (Kontak Editorial) — Jurnal Permukiman", topics: ["Kontak", "Alamat Redaksi"] },
];

export interface PortalUrlConfig {
  crawlBaseUrl: string;
  publicBaseUrl: string;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function stripArticleViewSuffix(url: string): string {
  return url.replace(/\/article\/view\/?$/i, "");
}

function stripOaiSuffix(url: string): string {
  return url.replace(/\/oai\/?$/i, "");
}

/**
 * Menentukan base URL untuk crawl OJS aktif (Opsi 3A: OJS_PUBLIC_URL, mis. localhost:8000
 * di lokal atau domain produksi di VPS) serta URL rujukan publik yang disimpan di sitasi.
 */
export function resolvePortalUrls(env: Record<string, string | undefined> = process.env): PortalUrlConfig {
  const fromPublic = env.OJS_PUBLIC_URL?.trim();
  const fromArticle = env.OJS_ARTICLE_BASE_URL?.trim()
    ? stripArticleViewSuffix(env.OJS_ARTICLE_BASE_URL.trim())
    : "";
  const fromOai = env.OJS_OAI_URL?.trim()
    ? stripOaiSuffix(env.OJS_OAI_URL.trim())
    : "";
  const publicBaseUrl = stripTrailingSlash(
    fromPublic || fromArticle || fromOai || "http://localhost:8000/index.php/JP",
  );
  const crawlOverride = env.OJS_PORTAL_CRAWL_URL?.trim();
  const crawlBaseUrl = stripTrailingSlash(crawlOverride || publicBaseUrl);
  return { crawlBaseUrl, publicBaseUrl };
}

/**
 * Menentukan base URL tautan artikel terbit OJS (`/article/view`).
 * Memprioritaskan OJS_ARTICLE_BASE_URL, lalu OJS_PUBLIC_URL, lalu OJS_OAI_URL
 * (tanpa akhiran `/oai`), dan terakhir fallback ke server OJS lokal port 8000.
 */
export function resolveOjsArticleBaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const explicitArticle = env.OJS_ARTICLE_BASE_URL?.trim();
  if (explicitArticle) return stripTrailingSlash(explicitArticle);
  const { publicBaseUrl } = resolvePortalUrls(env);
  return `${publicBaseUrl}/article/view`;
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  ndash: "-",
  mdash: "-",
  middot: "·",
  bull: "•",
  copy: "©",
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (full, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? full;
  });
}

/**
 * Mengekstrak bagian konten utama halaman OJS (.pkp_structure_main) dan
 * membuang header, navigasi, breadcrumb, sidebar, footer, serta skrip.
 */
export function extractOjsMainContent(html: string): { htmlTitle: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawHtmlTitle = titleMatch
    ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim()
    : "";

  let fragment = html;
  const mainStart = html.search(/<div[^>]*class=["'][^"']*\bpkp_structure_main\b[^"']*["'][^>]*>/i);
  if (mainStart >= 0) {
    const afterStart = html.slice(mainStart);
    const stopMarkers = [
      "<!-- pkp_structure_main -->",
      '<div class="pkp_structure_sidebar',
      '<div class="pkp_structure_footer_wrapper',
      "<footer",
    ];
    let endIdx = afterStart.length;
    for (const marker of stopMarkers) {
      const idx = afterStart.indexOf(marker);
      if (idx > 0 && idx < endIdx) {
        endIdx = idx;
      }
    }
    fragment = afterStart.slice(0, endIdx);
  } else {
    const mainTag = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
    if (mainTag) {
      fragment = mainTag[1];
    } else {
      const bodyTag = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyTag) fragment = bodyTag[1];
    }
  }

  fragment = fragment
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav\b[^>]*class=["'][^"']*\bcmp_breadcrumbs\b[^"']*["'][^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const withFormatting = fragment
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/(p|h[1-6]|li|tr|div|section|article|blockquote|table|ul|ol)>/gi, "\n")
    .replace(/<\/(td|th)>/gi, " | ")
    .replace(/<[^>]+>/g, " ");

  const decoded = decodeHtmlEntities(withFormatting);
  const lines = decoded
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .filter((line) => line.length > 0 && line !== "|");

  const compacted: string[] = [];
  for (const line of lines) {
    if (compacted.length === 0 || compacted[compacted.length - 1] !== line) {
      compacted.push(line);
    }
  }

  return {
    htmlTitle: rawHtmlTitle,
    text: compacted.join("\n"),
  };
}

export function computeContentHash(parts: string[]): string {
  return createHash("sha256").update(parts.join("\n---\n"), "utf8").digest("hex");
}

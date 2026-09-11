import { randomUUID } from "node:crypto";
import { db, type RegulationKind, type RegulationMentionRecord } from "./db";

export interface ExtractedMention {
  jenis: RegulationKind;
  /** Kunci lintas-edisi, mis. "SNI-1726". */
  nomor_normal: string;
  /** Bentuk rapi untuk ditampilkan, mis. "SNI 03-1726-2002". */
  nomor_lengkap: string;
  /** Tahun edisi/penetapan; null kalau tidak tercantum. */
  tahun: number | null;
  /** Potongan teks apa adanya seperti tertulis di naskah. */
  teks_asli: string;
}

interface Pattern {
  jenis: RegulationKind;
  regex: RegExp;
  build: (m: RegExpMatchArray) => Omit<ExtractedMention, "jenis" | "teks_asli"> | null;
}

/** Tahun terbit yang masuk akal untuk peraturan Indonesia. */
function parseYear(value: string | undefined): number | null {
  if (!value) return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1945 || year > 2100) return null;
  return year;
}

// Catatan: pola sengaja MEWAJIBKAN nomor + tahun. Penyebutan telanjang seperti
// "SNI 2013" atau "sesuai SNI" tidak ditangkap, karena tanpa nomor standar ia
// tidak bisa dipakai untuk apa pun dan hanya jadi derau.
const PATTERNS: Pattern[] = [
  {
    // SNI 03-1726-2002 | SNI 1726:2019 | SNI 2847-2019 | SNI 8363:2017
    jenis: "SNI",
    regex: /\bSNI\s*(?:(\d{2})\s*-\s*)?(\d{3,4})\s*[-:]\s*(\d{4})\b/gi,
    build: (m) => {
      const tahun = parseYear(m[3]);
      if (!tahun) return null;
      const prefix = m[1] ? `${m[1]}-` : "";
      return {
        nomor_normal: `SNI-${m[2]}`,
        nomor_lengkap: `SNI ${prefix}${m[2]}${m[1] ? "-" : ":"}${m[3]}`,
        tahun,
      };
    },
  },
  {
    // Permen PU No. 18/PRT/M/2007 | Peraturan Menteri PUPR Nomor 27/PRT/M/2016
    jenis: "PERMEN",
    regex: /(\d{1,3})\s*\/\s*PRT\s*\/\s*M\s*\/\s*(\d{4})/gi,
    build: (m) => {
      const tahun = parseYear(m[2]);
      if (!tahun) return null;
      return {
        nomor_normal: `PERMENPU-${m[1]}/PRT/M`,
        nomor_lengkap: `Permen PUPR No. ${m[1]}/PRT/M/${m[2]}`,
        tahun,
      };
    },
  },
  {
    // Permen PUPR No. 1 Tahun 2022 (format baru, tanpa PRT/M), termasuk bentuk
    // panjang "Permen Pekerjaan Umum dan Perumahan Rakyat (PUPR) Nomor 21
    // Tahun 2021" — nama kementerian dieja penuh dengan singkatan dalam kurung.
    jenis: "PERMEN",
    regex:
      /\b(?:Permen|Peraturan\s+Menteri)[\w\s.,&()/-]{0,70}?\s*(?:No\.?|Nomor)\s*(\d{1,3})\s+Tahun\s+(\d{4})\b/gi,
    build: (m) => {
      const tahun = parseYear(m[2]);
      if (!tahun) return null;
      return {
        nomor_normal: `PERMEN-${m[1]}-${m[2]}`,
        nomor_lengkap: `Permen No. ${m[1]} Tahun ${m[2]}`,
        tahun,
      };
    },
  },
  {
    // PP No. 22 Tahun 2021 | Peraturan Pemerintah Nomor 122 Tahun 2015
    jenis: "PP",
    regex:
      /\b(?:PP|Peraturan\s+Pemerintah)(?:\s*\([^)]{1,25}\))?\s*(?:No\.?|Nomor)?\s*(\d{1,3})\s+Tahun\s+(\d{4})\b/gi,
    build: (m) => {
      const tahun = parseYear(m[2]);
      if (!tahun) return null;
      return {
        nomor_normal: `PP-${m[1]}-${m[2]}`,
        nomor_lengkap: `PP No. ${m[1]} Tahun ${m[2]}`,
        tahun,
      };
    },
  },
  {
    // UU No. 28 Tahun 2002 | Undang-Undang Nomor 1 Tahun 2011
    jenis: "UU",
    regex:
      /\b(?:UU|Undang[-\s]?Undang)(?:\s*\([^)]{1,25}\))?\s*(?:No\.?|Nomor)?\s*(\d{1,3})\s+Tahun\s+(\d{4})\b/gi,
    build: (m) => {
      const tahun = parseYear(m[2]);
      if (!tahun) return null;
      return {
        nomor_normal: `UU-${m[1]}-${m[2]}`,
        nomor_lengkap: `UU No. ${m[1]} Tahun ${m[2]}`,
        tahun,
      };
    },
  },
  {
    // Perpres No. 18 Tahun 2020
    jenis: "PERPRES",
    regex:
      /\b(?:Perpres|Peraturan\s+Presiden)(?:\s*\([^)]{1,25}\))?\s*(?:No\.?|Nomor)?\s*(\d{1,3})\s+Tahun\s+(\d{4})\b/gi,
    build: (m) => {
      const tahun = parseYear(m[2]);
      if (!tahun) return null;
      return {
        nomor_normal: `PERPRES-${m[1]}-${m[2]}`,
        nomor_lengkap: `Perpres No. ${m[1]} Tahun ${m[2]}`,
        tahun,
      };
    },
  },
];

/**
 * Panen penyebutan peraturan/SNI dari sepotong teks naskah.
 *
 * Sengaja berbasis regex, bukan LLM: nomor peraturan adalah data yang harus
 * persis, dan model bahasa justru rawan menggeser digit. Hasilnya di-dedup
 * per nomor_lengkap supaya satu chunk yang menyebut standar yang sama
 * berkali-kali tidak menggelembungkan hitungan.
 */
export function extractRegulationMentions(text: string): ExtractedMention[] {
  const found = new Map<string, ExtractedMention>();

  for (const pattern of PATTERNS) {
    for (const match of text.matchAll(pattern.regex)) {
      const parts = pattern.build(match);
      if (!parts) continue;
      const key = `${pattern.jenis}:${parts.nomor_lengkap}`;
      if (found.has(key)) continue;
      found.set(key, {
        jenis: pattern.jenis,
        ...parts,
        teks_asli: match[0].replace(/\s+/g, " ").trim(),
      });
    }
  }

  return Array.from(found.values());
}

interface ChunkForHarvest {
  id: string;
  document_id: string;
  content: string;
}

/**
 * Panen ulang seluruh rujukan milik satu dokumen. Dipanggil setiap kali chunk
 * dokumen dibuat ulang, jadi isinya selalu sinkron dengan chunk yang berlaku.
 */
export function replaceRegulationMentions(
  documentId: string,
  chunks: ChunkForHarvest[]
): number {
  const now = new Date().toISOString();
  const rows: RegulationMentionRecord[] = [];

  for (const chunk of chunks) {
    for (const mention of extractRegulationMentions(chunk.content)) {
      rows.push({
        id: randomUUID(),
        chunk_id: chunk.id,
        document_id: documentId,
        created_at: now,
        ...mention,
      });
    }
  }

  const write = db.transaction(() => {
    db.prepare("DELETE FROM regulation_mentions WHERE document_id = ?").run(
      documentId
    );
    const insert = db.prepare(
      `INSERT INTO regulation_mentions
         (id, chunk_id, document_id, jenis, nomor_normal, nomor_lengkap, tahun, teks_asli, created_at)
       VALUES
         (@id, @chunk_id, @document_id, @jenis, @nomor_normal, @nomor_lengkap, @tahun, @teks_asli, @created_at)`
    );
    for (const row of rows) insert.run(row);
  });
  write();

  return rows.length;
}

/** Panen ulang untuk SELURUH korpus. Dipakai sekali saat backfill. */
export function backfillRegulationMentions(): {
  documents: number;
  mentions: number;
} {
  const documentIds = db
    .prepare("SELECT DISTINCT document_id FROM chunks")
    .all() as { document_id: string }[];

  let mentions = 0;
  for (const { document_id } of documentIds) {
    const chunks = db
      .prepare("SELECT id, document_id, content FROM chunks WHERE document_id = ?")
      .all(document_id) as ChunkForHarvest[];
    mentions += replaceRegulationMentions(document_id, chunks);
  }

  return { documents: documentIds.length, mentions };
}

export interface RegulationSummary {
  jenis: RegulationKind;
  nomor_normal: string;
  nomor_lengkap: string;
  tahun: number | null;
  mention_count: number;
  document_count: number;
}

/** Daftar peraturan yang paling sering dirujuk korpus. */
export function listRegulations(limit = 100): RegulationSummary[] {
  return db
    .prepare(
      `SELECT jenis, nomor_normal, nomor_lengkap, tahun,
              COUNT(*) as mention_count,
              COUNT(DISTINCT document_id) as document_count
       FROM regulation_mentions
       GROUP BY jenis, nomor_lengkap
       ORDER BY document_count DESC, mention_count DESC
       LIMIT ?`
    )
    .all(limit) as RegulationSummary[];
}

/** Peraturan yang dirujuk satu naskah tertentu. */
export function listRegulationsForDocument(
  documentId: string
): RegulationSummary[] {
  return db
    .prepare(
      `SELECT jenis, nomor_normal, nomor_lengkap, tahun,
              COUNT(*) as mention_count,
              COUNT(DISTINCT document_id) as document_count
       FROM regulation_mentions
       WHERE document_id = ?
       GROUP BY jenis, nomor_lengkap
       ORDER BY mention_count DESC`
    )
    .all(documentId) as RegulationSummary[];
}

export interface RegulationCitingDocument {
  document_id: string;
  filename: string;
  title: string;
  published_year: number | null;
  /** Kutipan kalimat di sekitar penyebutan, untuk dibaca tanpa membuka naskah. */
  snippets: { chunk_index: number; text: string }[];
}

export interface RegulationDetail {
  jenis: RegulationKind;
  nomor_normal: string;
  nomor_lengkap: string;
  tahun: number | null;
  /** Judul resmi menurut naskah yang merujuk; null kalau tak satu pun menyebutnya. */
  judul: string | null;
  /** Judul lain yang ikut ditemukan — kalau berbeda, itu tanda perlu diperiksa. */
  judul_varian: string[];
  /** Pasal/ayat yang disebut naskah saat mengutip peraturan ini. */
  pasal_disebut: string[];
  /** Tautan sumber resmi hasil kurasi admin; null kalau belum dikurasi. */
  link: RegulationLink | null;
  /** Cadangan: pencarian JDIH BPK dengan nomor peraturan sebagai kata kunci. */
  jdih_search_url: string;
  /** Edisi lain dari standar yang sama yang juga beredar di korpus. */
  editions: { nomor_lengkap: string; tahun: number | null; document_count: number }[];
  documents: RegulationCitingDocument[];
}

export interface RegulationLink {
  nomor_lengkap: string;
  url: string;
  judul_resmi: string;
  curated_by: string | null;
  curated_at: string;
}

/**
 * Host JDIH resmi yang boleh disimpan sebagai tautan sumber.
 *
 * Daftar tertutup, bukan sembarang URL: tautan ini ditampilkan sebagai rujukan
 * resmi kepada peneliti, jadi tidak boleh bisa diarahkan ke situs mana pun.
 */
const ALLOWED_LINK_HOSTS = new Set([
  "peraturan.bpk.go.id",
  "jdih.pu.go.id",
  "jdih.maritim.go.id",
  "peraturan.go.id",
  "bsn.go.id",
  "akses-sni.bsn.go.id",
]);

export function isAllowedRegulationUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_LINK_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Tautan pencarian JDIH BPK sebagai cadangan saat belum ada URL terkurasi. */
export function buildJdihSearchUrl(nomorLengkap: string): string {
  return `https://peraturan.bpk.go.id/Search?keywords=${encodeURIComponent(nomorLengkap)}`;
}

export function getRegulationLink(nomorLengkap: string): RegulationLink | null {
  return (
    (db
      .prepare("SELECT * FROM regulation_links WHERE nomor_lengkap = ?")
      .get(nomorLengkap) as RegulationLink | undefined) ?? null
  );
}

export function upsertRegulationLink(input: {
  nomor_lengkap: string;
  url: string;
  judul_resmi?: string;
  curated_by?: string;
}): RegulationLink {
  if (!isAllowedRegulationUrl(input.url)) {
    throw new Error(
      "URL harus https dan berasal dari situs JDIH resmi (mis. peraturan.bpk.go.id)"
    );
  }

  const row: RegulationLink = {
    nomor_lengkap: input.nomor_lengkap,
    url: input.url,
    judul_resmi: input.judul_resmi?.trim() ?? "",
    curated_by: input.curated_by ?? null,
    curated_at: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO regulation_links (nomor_lengkap, url, judul_resmi, curated_by, curated_at)
     VALUES (@nomor_lengkap, @url, @judul_resmi, @curated_by, @curated_at)
     ON CONFLICT(nomor_lengkap) DO UPDATE SET
       url = excluded.url,
       judul_resmi = excluded.judul_resmi,
       curated_by = excluded.curated_by,
       curated_at = excluded.curated_at`
  ).run(row);

  return row;
}

export function deleteRegulationLink(nomorLengkap: string): void {
  db.prepare("DELETE FROM regulation_links WHERE nomor_lengkap = ?").run(nomorLengkap);
}

const SNIPPET_RADIUS = 200;

/**
 * Judul resmi peraturan, dipungut dari pola "<nomor> tentang <judul>" yang
 * hampir selalu dipakai naskah ilmiah Indonesia saat menyebut aturan.
 *
 * Ini satu-satunya cara jujur menampilkan "isi peraturan" selama teks aslinya
 * belum ada di sistem: judulnya diambil apa adanya dari kalimat naskah, bukan
 * dari pengetahuan model.
 */
/** Kata yang menandai judul sudah habis dan kalimat naskah dimulai. */
const CLAUSE_MARKER_WORDS =
  "yang|yaitu|dimana|di\\s+mana|sebagaimana|menjelaskan|menyebutkan|menetapkan|mengatur|mensyaratkan|mewajibkan|menyatakan|disebutkan|dinyatakan|dijelaskan|sebesar|adalah|merupakan";
const CLAUSE_MARKERS_MID = new RegExp(`\\s+(?:${CLAUSE_MARKER_WORDS})\\s+`, "i");
const CLAUSE_MARKERS_END = new RegExp(`\\s+(?:${CLAUSE_MARKER_WORDS})\\s*$`, "i");

export function extractRegulationTitle(
  content: string,
  teksAsli: string
): string | null {
  const clean = content.replace(/\s+/g, " ");
  const needle = teksAsli.replace(/\s+/g, " ").trim();
  const at = clean.toLowerCase().indexOf(needle.toLowerCase());
  if (at === -1) return null;

  const after = clean.slice(at + needle.length);
  // Koma ikut menjadi pembatas: judul resmi peraturan jarang memuatnya,
  // sementara anak kalimat sesudahnya ("…, yang mengatur…") hampir selalu.
  const match = after.match(/^[^\w]*tentang\s+([^.;:,]{5,160})/i);
  if (!match) return null;

  // Banyak naskah menyambung judul langsung ke anak kalimat tanpa koma
  // ("…tentang Bangunan Gedung yang turut menyertakan…"). Penanda seperti
  // "yang"/"yaitu" menandai akhir judul resminya.
  return match[1]
    .split(CLAUSE_MARKERS_MID)[0]
    // Penanda yang jatuh persis di ujung potongan tidak punya spasi sesudahnya,
    // jadi perlu dibuang terpisah — mis. "…di Kawasan Perkotaan menetapkan".
    .replace(CLAUSE_MARKERS_END, "")
    .replace(/\s+/g, " ")
    .replace(/[,\s]+$/, "")
    .trim();
}

/** Pasal/ayat yang disebut berbarengan dengan peraturannya. */
export function extractCitedArticles(
  content: string,
  teksAsli: string
): string[] {
  const clean = content.replace(/\s+/g, " ");
  const needle = teksAsli.replace(/\s+/g, " ").trim();
  const at = clean.toLowerCase().indexOf(needle.toLowerCase());
  if (at === -1) return [];

  // Hanya lihat sedikit di belakang penyebutan, supaya pasal milik peraturan
  // lain di kalimat berikutnya tidak ikut terbawa.
  const window = clean.slice(at + needle.length, at + needle.length + 90);
  const found = new Set<string>();

  for (const m of window.matchAll(
    /Pasal\s+(\d{1,3}(?:\s*[–—-]\s*\d{1,3})?)(?:\s*ayat\s*\((\d{1,2})\))?/gi
  )) {
    const pasal = m[1].replace(/\s*[–—-]\s*/, "–");
    found.add(m[2] ? `Pasal ${pasal} ayat (${m[2]})` : `Pasal ${pasal}`);
  }

  return Array.from(found);
}

/** Ambil potongan teks di sekitar penyebutan supaya konteksnya terbaca. */
function buildSnippet(content: string, teksAsli: string): string {
  const clean = content.replace(/\s+/g, " ").trim();
  const needle = teksAsli.replace(/\s+/g, " ").trim();
  const at = clean.toLowerCase().indexOf(needle.toLowerCase());
  if (at === -1) return clean.slice(0, SNIPPET_RADIUS * 2);

  const start = Math.max(0, at - SNIPPET_RADIUS);
  const end = Math.min(clean.length, at + needle.length + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
}

/** Rincian satu peraturan: siapa merujuknya, di kalimat apa, dan edisi lainnya. */
export function getRegulationDetail(nomorLengkap: string): RegulationDetail | null {
  const head = db
    .prepare(
      `SELECT jenis, nomor_normal, nomor_lengkap, tahun
       FROM regulation_mentions WHERE nomor_lengkap = ? LIMIT 1`
    )
    .get(nomorLengkap) as
    | { jenis: RegulationKind; nomor_normal: string; nomor_lengkap: string; tahun: number | null }
    | undefined;

  if (!head) return null;

  const editions = db
    .prepare(
      `SELECT nomor_lengkap, tahun, COUNT(DISTINCT document_id) as document_count
       FROM regulation_mentions WHERE nomor_normal = ?
       GROUP BY nomor_lengkap ORDER BY tahun DESC`
    )
    .all(head.nomor_normal) as RegulationDetail["editions"];

  const rows = db
    .prepare(
      `SELECT m.document_id, m.teks_asli, c.chunk_index, c.content,
              d.filename, d.title, d.published_year
       FROM regulation_mentions m
       JOIN chunks c ON c.id = m.chunk_id
       JOIN documents d ON d.id = m.document_id
       WHERE m.nomor_lengkap = ?
       ORDER BY d.published_year DESC, c.chunk_index ASC`
    )
    .all(nomorLengkap) as {
    document_id: string;
    teks_asli: string;
    chunk_index: number;
    content: string;
    filename: string;
    title: string;
    published_year: number | null;
  }[];

  const byDocument = new Map<string, RegulationCitingDocument>();
  const titleCounts = new Map<string, number>();
  const articles = new Set<string>();

  for (const row of rows) {
    let entry = byDocument.get(row.document_id);
    if (!entry) {
      entry = {
        document_id: row.document_id,
        filename: row.filename,
        title: row.title,
        published_year: row.published_year,
        snippets: [],
      };
      byDocument.set(row.document_id, entry);
    }
    entry.snippets.push({
      chunk_index: row.chunk_index,
      text: buildSnippet(row.content, row.teks_asli),
    });

    const judul = extractRegulationTitle(row.content, row.teks_asli);
    if (judul) titleCounts.set(judul, (titleCounts.get(judul) ?? 0) + 1);
    for (const pasal of extractCitedArticles(row.content, row.teks_asli)) {
      articles.add(pasal);
    }
  }

  // Judul yang paling sering disebut dipakai sebagai judul utama; sisanya jadi
  // varian agar perbedaan penulisan terlihat, bukan disembunyikan. Varian yang
  // cuma potongan/perpanjangan dari judul utama dibuang — itu variasi cara
  // mengutip, bukan judul yang benar-benar berbeda.
  const rankedTitles = Array.from(titleCounts.entries()).sort(
    (a, b) => b[1] - a[1] || b[0].length - a[0].length
  );
  const mainTitle = rankedTitles[0]?.[0] ?? null;
  const variants = rankedTitles
    .slice(1)
    .map(([t]) => t)
    .filter((t) => {
      if (!mainTitle) return true;
      const a = t.toLowerCase();
      const b = mainTitle.toLowerCase();
      return !a.startsWith(b) && !b.startsWith(a);
    })
    .slice(0, 3);

  return {
    ...head,
    judul: mainTitle,
    judul_varian: variants,
    link: getRegulationLink(nomorLengkap),
    jdih_search_url: buildJdihSearchUrl(nomorLengkap),
    pasal_disebut: Array.from(articles).sort(
      (a, b) => (parseInt(a.replace(/\D/g, ""), 10) || 0) - (parseInt(b.replace(/\D/g, ""), 10) || 0)
    ),
    editions,
    documents: Array.from(byDocument.values()),
  };
}

export interface OutdatedEdition {
  nomor_normal: string;
  dirujuk: string;
  tahun_dirujuk: number;
  edisi_terbaru: string;
  tahun_terbaru: number;
  document_id: string;
  filename: string;
  title: string;
}

/**
 * Naskah yang merujuk edisi lama sebuah standar, padahal korpus yang sama
 * sudah memuat edisi yang lebih baru.
 *
 * Deteksi ini murni berbasis korpus — TIDAK menyatakan bahwa edisi lama sudah
 * dicabut (sistem belum punya data status resmi), hanya bahwa ada edisi yang
 * lebih baru yang beredar di korpus. Penetapan status tetap urusan kurator.
 */
export function findOutdatedEditions(): OutdatedEdition[] {
  const latest = db
    .prepare(
      `SELECT nomor_normal, MAX(tahun) as tahun_terbaru
       FROM regulation_mentions
       WHERE tahun IS NOT NULL
       GROUP BY nomor_normal
       HAVING COUNT(DISTINCT tahun) > 1`
    )
    .all() as { nomor_normal: string; tahun_terbaru: number }[];

  const results: OutdatedEdition[] = [];
  for (const { nomor_normal, tahun_terbaru } of latest) {
    const newest = db
      .prepare(
        `SELECT nomor_lengkap FROM regulation_mentions
         WHERE nomor_normal = ? AND tahun = ? LIMIT 1`
      )
      .get(nomor_normal, tahun_terbaru) as { nomor_lengkap: string } | undefined;

    const stale = db
      .prepare(
        `SELECT DISTINCT m.nomor_lengkap, m.tahun, m.document_id, d.filename, d.title
         FROM regulation_mentions m
         JOIN documents d ON d.id = m.document_id
         WHERE m.nomor_normal = ? AND m.tahun < ?`
      )
      .all(nomor_normal, tahun_terbaru) as {
      nomor_lengkap: string;
      tahun: number;
      document_id: string;
      filename: string;
      title: string;
    }[];

    for (const row of stale) {
      results.push({
        nomor_normal,
        dirujuk: row.nomor_lengkap,
        tahun_dirujuk: row.tahun,
        edisi_terbaru: newest?.nomor_lengkap ?? `${nomor_normal} (${tahun_terbaru})`,
        tahun_terbaru,
        document_id: row.document_id,
        filename: row.filename,
        title: row.title,
      });
    }
  }

  return results.sort((a, b) => b.tahun_terbaru - a.tahun_terbaru);
}

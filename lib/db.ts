import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const storageDir = path.join(process.cwd(), "storage");
const pdfDir = path.join(storageDir, "pdfs");
const dbPath = path.join(storageDir, "db.sqlite");

fs.mkdirSync(pdfDir, { recursive: true });

declare global {
  var __db: Database.Database | undefined;
}

const db = global.__db ?? new Database(dbPath);
if (process.env.NODE_ENV !== "production") {
  global.__db = db;
}

db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    extracted_text TEXT NOT NULL,
    extraction_method TEXT NOT NULL DEFAULT 'local',
    page_count INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    char_count INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )
`);
db.exec(
  "CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id)"
);

// Pencarian kata kunci (FTS5) sebagai pelengkap pencarian embedding — model
// embedding lokal (MiniLM) sering melewatkan istilah/angka spesifik (mis.
// "1000°C") yang justru mudah ditemukan lewat pencocokan kata literal.
const ftsExisted = Boolean(
  db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chunks_fts'").get()
);
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
    content,
    content='chunks',
    content_rowid='rowid'
  )
`);
if (!ftsExisted) {
  db.exec("INSERT INTO chunks_fts(rowid, content) SELECT rowid, content FROM chunks");
}
db.exec(`
  CREATE TRIGGER IF NOT EXISTS chunks_fts_ai AFTER INSERT ON chunks BEGIN
    INSERT INTO chunks_fts(rowid, content) VALUES (new.rowid, new.content);
  END
`);
db.exec(`
  CREATE TRIGGER IF NOT EXISTS chunks_fts_ad AFTER DELETE ON chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
  END
`);
db.exec(`
  CREATE TRIGGER IF NOT EXISTS chunks_fts_au AFTER UPDATE ON chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
    INSERT INTO chunks_fts(rowid, content) VALUES (new.rowid, new.content);
  END
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS embeddings (
    id TEXT PRIMARY KEY,
    chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    vector BLOB NOT NULL,
    created_at TEXT NOT NULL
  )
`);
db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_chunk_id ON embeddings(chunk_id)"
);
db.exec(
  "CREATE INDEX IF NOT EXISTS idx_embeddings_document_id ON embeddings(document_id)"
);

// Rujukan peraturan/SNI yang disebut DI DALAM naskah. Dipanen dari teks chunk
// (bukan dari korpus peraturan tersendiri) supaya sistem bisa menjawab
// "peraturan apa yang relevan untuk topik ini" tanpa perlu mengunggah teks
// peraturan aslinya lebih dulu.
db.exec(`
  CREATE TABLE IF NOT EXISTS regulation_mentions (
    id TEXT PRIMARY KEY,
    chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    jenis TEXT NOT NULL,
    nomor_normal TEXT NOT NULL,
    nomor_lengkap TEXT NOT NULL,
    tahun INTEGER,
    teks_asli TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);
db.exec(
  "CREATE INDEX IF NOT EXISTS idx_regmentions_document_id ON regulation_mentions(document_id)"
);
db.exec(
  "CREATE INDEX IF NOT EXISTS idx_regmentions_chunk_id ON regulation_mentions(chunk_id)"
);
// Kunci lintas-edisi: SNI 03-6389-2000 dan SNI 6389:2020 punya nomor_normal
// yang sama, sehingga selisih edisinya bisa dideteksi lewat indeks ini.
db.exec(
  "CREATE INDEX IF NOT EXISTS idx_regmentions_nomor_normal ON regulation_mentions(nomor_normal)"
);

// Klaim terstruktur yang dipungut dari naskah — mengubah teks bebas menjadi
// baris yang bisa dibandingkan antar naskah. Diisi bertahap: tahap ini baru
// jenis 'keterbatasan' dan 'saran_lanjutan' (pernyataan celah riset), kolom
// temuan (metode/lokasi/nilai/arah) menyusul di tahap ekstraksi klaim penuh.
db.exec(`
  CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    jenis TEXT NOT NULL,
    teks TEXT NOT NULL,
    kutipan TEXT NOT NULL,
    topik TEXT NOT NULL DEFAULT '',
    metode TEXT,
    lokasi TEXT,
    variabel TEXT,
    nilai TEXT,
    satuan TEXT,
    arah TEXT,
    created_at TEXT NOT NULL
  )
`);
db.exec("CREATE INDEX IF NOT EXISTS idx_claims_document_id ON claims(document_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_claims_jenis ON claims(jenis)");

// Tautan ke sumber resmi peraturan (JDIH). Dikurasi manual oleh admin, bukan
// ditebak sistem: nomor identitas dokumen di JDIH tidak bisa diturunkan dari
// nomor peraturan, dan menebaknya berisiko mengarahkan pengguna ke aturan lain.
db.exec(`
  CREATE TABLE IF NOT EXISTS regulation_links (
    nomor_lengkap TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    judul_resmi TEXT NOT NULL DEFAULT '',
    curated_by TEXT,
    curated_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS chat_history (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sources TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);
db.exec(
  "CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at)"
);

db.exec(`
  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    instructions TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

function ensureColumn(table: string, column: string, ddl: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

ensureColumn(
  "documents",
  "extraction_method",
  "extraction_method TEXT NOT NULL DEFAULT 'local'"
);
ensureColumn("documents", "title", "title TEXT NOT NULL DEFAULT ''");
ensureColumn("documents", "authors", "authors TEXT NOT NULL DEFAULT '[]'");
ensureColumn("documents", "abstract", "abstract TEXT NOT NULL DEFAULT ''");
ensureColumn("documents", "doi", "doi TEXT NOT NULL DEFAULT ''");
ensureColumn("documents", "published_year", "published_year INTEGER");
ensureColumn("documents", "volume", "volume TEXT NOT NULL DEFAULT ''");
ensureColumn("documents", "issue_number", "issue_number TEXT NOT NULL DEFAULT ''");
ensureColumn("documents", "topics", "topics TEXT NOT NULL DEFAULT '[]'");
ensureColumn(
  "documents",
  "source",
  "source TEXT NOT NULL DEFAULT 'manual_upload'"
);
ensureColumn("documents", "ojs_article_id", "ojs_article_id TEXT");
ensureColumn("documents", "synced_at", "synced_at TEXT");
ensureColumn("chat_history", "mode", "mode TEXT NOT NULL DEFAULT 'chat'");
ensureColumn("chat_history", "evidence_strength", "evidence_strength TEXT");
ensureColumn("chat_history", "points", "points TEXT");
ensureColumn("chat_history", "user_id", "user_id TEXT");

db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_ojs_article_id ON documents(ojs_article_id) WHERE ojs_article_id IS NOT NULL"
);

db.exec(`
  CREATE TABLE IF NOT EXISTS sync_runs (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    new_documents_found INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running',
    error_message TEXT,
    detail TEXT
  )
`);
db.exec(
  "CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON sync_runs(started_at)"
);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'unit_user',
    unit TEXT,
    created_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    target_id TEXT,
    detail TEXT,
    created_at TEXT NOT NULL
  )
`);
db.exec(
  "CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)"
);

export type ExtractionMethod = "local" | "gemini";
export type DocumentSource = "ojs_harvest" | "manual_upload";

export interface DocumentRecord {
  id: string;
  filename: string;
  stored_path: string;
  extracted_text: string;
  extraction_method: ExtractionMethod;
  page_count: number;
  uploaded_at: string;
  title: string;
  authors: string; // JSON string array
  abstract: string;
  doi: string;
  published_year: number | null;
  volume: string;
  issue_number: string;
  topics: string; // JSON string array
  source: DocumentSource;
  ojs_article_id: string | null;
  synced_at: string | null;
}

export interface SyncRunRecord {
  id: string;
  started_at: string;
  finished_at: string | null;
  new_documents_found: number;
  status: "running" | "success" | "partial" | "failed";
  error_message: string | null;
  detail: string | null;
}

export interface ChunkRecord {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  char_count: number;
  created_at: string;
}

export interface EmbeddingRecord {
  id: string;
  chunk_id: string;
  document_id: string;
  model: string;
  dimensions: number;
  vector: Buffer;
  created_at: string;
}

export type QueryMode = "chat" | "kajian";
export type EvidenceStrength = "kuat" | "sedang" | "lemah";

export interface ChatHistoryRecord {
  id: string;
  question: string;
  answer: string;
  sources: string;
  created_at: string;
  mode: QueryMode;
  evidence_strength: EvidenceStrength | null;
  points: string | null;
  user_id: string | null;
}

export type ClaimKind = "keterbatasan" | "saran_lanjutan" | "temuan";

export interface ClaimRecord {
  id: string;
  document_id: string;
  chunk_id: string;
  jenis: ClaimKind;
  /** Pernyataan yang sudah dirapikan menjadi satu kalimat mandiri. */
  teks: string;
  /** Kalimat asli dari naskah — bukti bahwa klaim ini tidak dikarang. */
  kutipan: string;
  topik: string;
  metode: string | null;
  lokasi: string | null;
  variabel: string | null;
  nilai: string | null;
  satuan: string | null;
  arah: string | null;
  created_at: string;
}

export type RegulationKind =
  | "SNI"
  | "PERMEN"
  | "PP"
  | "UU"
  | "PERPRES"
  | "SE";

export interface RegulationMentionRecord {
  id: string;
  chunk_id: string;
  document_id: string;
  jenis: RegulationKind;
  /** Kunci lintas-edisi, mis. "SNI-1726" untuk SNI 03-1726-2002 & SNI 1726:2019. */
  nomor_normal: string;
  nomor_lengkap: string;
  tahun: number | null;
  teks_asli: string;
  created_at: string;
}

export interface SkillRecord {
  id: string;
  name: string;
  description: string;
  instructions: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export type UserRole = "admin" | "unit_user";

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  unit: string | null;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  user_id: string;
  action: string;
  target_id: string | null;
  detail: string | null;
  created_at: string;
}

export { db, pdfDir };

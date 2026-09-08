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

const existingColumns = db
  .prepare("PRAGMA table_info(documents)")
  .all() as { name: string }[];
if (!existingColumns.some((c) => c.name === "extraction_method")) {
  db.exec(
    "ALTER TABLE documents ADD COLUMN extraction_method TEXT NOT NULL DEFAULT 'local'"
  );
}

export type ExtractionMethod = "local" | "gemini";

export interface DocumentRecord {
  id: string;
  filename: string;
  stored_path: string;
  extracted_text: string;
  extraction_method: ExtractionMethod;
  page_count: number;
  uploaded_at: string;
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

export interface ChatHistoryRecord {
  id: string;
  question: string;
  answer: string;
  sources: string;
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

export { db, pdfDir };

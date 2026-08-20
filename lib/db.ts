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

db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    extracted_text TEXT NOT NULL,
    page_count INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL
  )
`);

export interface DocumentRecord {
  id: string;
  filename: string;
  stored_path: string;
  extracted_text: string;
  page_count: number;
  uploaded_at: string;
}

export { db, pdfDir };

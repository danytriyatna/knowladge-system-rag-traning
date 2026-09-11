import postgres from "postgres";

declare global {
  var __sql: ReturnType<typeof postgres> | undefined;
}

// Connection string pooled (Supavisor, port 6543) dipakai untuk semua
// koneksi — lokal maupun Vercel — karena direct connection (port 5432) tidak
// selalu bisa dijangkau dari jaringan yang tidak punya rute IPv6.
const connectionString = process.env.DATABASE_URL_POOLED;
if (!connectionString) {
  throw new Error("DATABASE_URL_POOLED belum diset di environment");
}

// max:1 sesuai rekomendasi Supabase untuk serverless — tiap cold start
// Vercel bikin instance postgres.js baru, dan tanpa ini tiap instance
// membuka pool default (10 koneksi) yang menumpuk lintas cold start sampai
// slot koneksi Supavisor habis (request jadi hang, bukan error, menunggu
// slot yang tidak pernah kosong). idle_timeout melepas koneksi menganggur
// balik ke pooler, connect_timeout mencegah hang tanpa batas kalau pooler
// sendiri sedang penuh.
const sql =
  global.__sql ??
  postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });
if (process.env.NODE_ENV !== "production") {
  global.__sql = sql;
}

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
  /** Literal pgvector, mis. "[0.1,0.2,...]" — lihat lib/embedding.ts. */
  vector: string;
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

export { sql };

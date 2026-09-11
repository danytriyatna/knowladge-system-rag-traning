// Script migrasi satu-kali: storage/db.sqlite -> Supabase Postgres.
// Dijalankan manual (bukan bagian dari app Next.js): node scripts/migrate-to-supabase.mjs
//
// Urutan tabel mengikuti dependensi FK: users -> documents -> chunks ->
// embeddings -> regulation_mentions -> claims -> regulation_links ->
// chat_history -> skills -> sync_runs -> audit_log.
//
// Idempotent: tiap insert pakai ON CONFLICT (id) DO NOTHING, jadi aman
// dijalankan ulang kalau sempat gagal di tengah jalan.

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import postgres from "postgres";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvLocal();

const DB_PATH = path.join(process.cwd(), "storage", "db.sqlite");
const sqlite = new Database(DB_PATH, { readonly: true });
const sql = postgres(process.env.DATABASE_URL_POOLED, { prepare: false });

function bufferToVector(buffer) {
  return Array.from(new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4));
}

function toVectorLiteral(vec) {
  return `[${vec.join(",")}]`;
}

async function assertCountMatches(table, sqliteCount) {
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM ${sql(table)}`;
  const ok = count === sqliteCount;
  console.log(
    `${ok ? "OK " : "BEDA"}  ${table}: sqlite=${sqliteCount} supabase=${count}`
  );
  if (!ok) throw new Error(`Jumlah baris ${table} tidak cocok, berhenti.`);
}

async function migrateUsers() {
  const rows = sqlite.prepare("SELECT * FROM users").all();
  for (const r of rows) {
    await sql`
      INSERT INTO users (id, email, password_hash, full_name, role, unit, created_at)
      VALUES (${r.id}, ${r.email}, ${r.password_hash}, ${r.full_name}, ${r.role}, ${r.unit}, ${r.created_at})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  await assertCountMatches("users", rows.length);
}

async function migrateDocuments() {
  const rows = sqlite.prepare("SELECT * FROM documents").all();
  for (const r of rows) {
    await sql`
      INSERT INTO documents (
        id, filename, stored_path, extracted_text, extraction_method, page_count,
        uploaded_at, title, authors, abstract, doi, published_year, volume,
        issue_number, topics, source, ojs_article_id, synced_at
      ) VALUES (
        ${r.id}, ${r.filename}, ${r.stored_path}, ${r.extracted_text}, ${r.extraction_method}, ${r.page_count},
        ${r.uploaded_at}, ${r.title}, ${r.authors}, ${r.abstract}, ${r.doi}, ${r.published_year}, ${r.volume},
        ${r.issue_number}, ${r.topics}, ${r.source}, ${r.ojs_article_id}, ${r.synced_at}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
  await assertCountMatches("documents", rows.length);
}

async function migrateChunks() {
  const rows = sqlite.prepare("SELECT * FROM chunks").all();
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((r) => ({
      id: r.id,
      document_id: r.document_id,
      chunk_index: r.chunk_index,
      content: r.content,
      char_count: r.char_count,
      created_at: r.created_at,
    }));
    await sql`
      INSERT INTO chunks ${sql(batch, "id", "document_id", "chunk_index", "content", "char_count", "created_at")}
      ON CONFLICT (id) DO NOTHING
    `;
    process.stdout.write(`\r  chunks: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  console.log();
  await assertCountMatches("chunks", rows.length);
}

async function migrateEmbeddings() {
  const rows = sqlite.prepare("SELECT * FROM embeddings").all();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const vectorLiteral = toVectorLiteral(bufferToVector(r.vector));
    await sql`
      INSERT INTO embeddings (id, chunk_id, document_id, model, dimensions, vector, created_at)
      VALUES (${r.id}, ${r.chunk_id}, ${r.document_id}, ${r.model}, ${r.dimensions}, ${vectorLiteral}::vector, ${r.created_at})
      ON CONFLICT (id) DO NOTHING
    `;
    if (i % 200 === 0 || i === rows.length - 1) {
      process.stdout.write(`\r  embeddings: ${i + 1}/${rows.length}`);
    }
  }
  console.log();
  await assertCountMatches("embeddings", rows.length);
}

async function migrateRegulationMentions() {
  const rows = sqlite.prepare("SELECT * FROM regulation_mentions").all();
  for (const r of rows) {
    await sql`
      INSERT INTO regulation_mentions (id, chunk_id, document_id, jenis, nomor_normal, nomor_lengkap, tahun, teks_asli, created_at)
      VALUES (${r.id}, ${r.chunk_id}, ${r.document_id}, ${r.jenis}, ${r.nomor_normal}, ${r.nomor_lengkap}, ${r.tahun}, ${r.teks_asli}, ${r.created_at})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  await assertCountMatches("regulation_mentions", rows.length);
}

async function migrateClaims() {
  const rows = sqlite.prepare("SELECT * FROM claims").all();
  for (const r of rows) {
    await sql`
      INSERT INTO claims (id, document_id, chunk_id, jenis, teks, kutipan, topik, metode, lokasi, variabel, nilai, satuan, arah, created_at)
      VALUES (${r.id}, ${r.document_id}, ${r.chunk_id}, ${r.jenis}, ${r.teks}, ${r.kutipan}, ${r.topik}, ${r.metode}, ${r.lokasi}, ${r.variabel}, ${r.nilai}, ${r.satuan}, ${r.arah}, ${r.created_at})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  await assertCountMatches("claims", rows.length);
}

async function migrateRegulationLinks() {
  const rows = sqlite.prepare("SELECT * FROM regulation_links").all();
  for (const r of rows) {
    await sql`
      INSERT INTO regulation_links (nomor_lengkap, url, judul_resmi, curated_by, curated_at)
      VALUES (${r.nomor_lengkap}, ${r.url}, ${r.judul_resmi}, ${r.curated_by}, ${r.curated_at})
      ON CONFLICT (nomor_lengkap) DO NOTHING
    `;
  }
  await assertCountMatches("regulation_links", rows.length);
}

async function migrateChatHistory() {
  const rows = sqlite.prepare("SELECT * FROM chat_history").all();
  for (const r of rows) {
    await sql`
      INSERT INTO chat_history (id, question, answer, sources, created_at, mode, evidence_strength, points, user_id)
      VALUES (${r.id}, ${r.question}, ${r.answer}, ${r.sources}, ${r.created_at}, ${r.mode}, ${r.evidence_strength}, ${r.points}, ${r.user_id})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  await assertCountMatches("chat_history", rows.length);
}

async function migrateSkills() {
  const rows = sqlite.prepare("SELECT * FROM skills").all();
  for (const r of rows) {
    await sql`
      INSERT INTO skills (id, name, description, instructions, enabled, created_at, updated_at)
      VALUES (${r.id}, ${r.name}, ${r.description}, ${r.instructions}, ${r.enabled}, ${r.created_at}, ${r.updated_at})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  await assertCountMatches("skills", rows.length);
}

async function migrateSyncRuns() {
  const rows = sqlite.prepare("SELECT * FROM sync_runs").all();
  for (const r of rows) {
    await sql`
      INSERT INTO sync_runs (id, started_at, finished_at, new_documents_found, status, error_message, detail)
      VALUES (${r.id}, ${r.started_at}, ${r.finished_at}, ${r.new_documents_found}, ${r.status}, ${r.error_message}, ${r.detail})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  await assertCountMatches("sync_runs", rows.length);
}

async function migrateAuditLog() {
  const rows = sqlite.prepare("SELECT * FROM audit_log").all();
  for (const r of rows) {
    await sql`
      INSERT INTO audit_log (id, user_id, action, target_id, detail, created_at)
      VALUES (${r.id}, ${r.user_id}, ${r.action}, ${r.target_id}, ${r.detail}, ${r.created_at})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  await assertCountMatches("audit_log", rows.length);
}

async function main() {
  console.log("=== Migrasi SQLite -> Supabase ===\n");
  await migrateUsers();
  await migrateDocuments();
  await migrateChunks();
  await migrateEmbeddings();
  await migrateRegulationMentions();
  await migrateClaims();
  await migrateRegulationLinks();
  await migrateChatHistory();
  await migrateSkills();
  await migrateSyncRuns();
  await migrateAuditLog();
  console.log("\nSelesai, semua tabel cocok jumlah barisnya.");
}

main()
  .catch((err) => {
    console.error("\nMIGRASI GAGAL:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    sqlite.close();
    await sql.end({ timeout: 5 });
  });

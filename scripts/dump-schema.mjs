// Ekstrak skema basis data dari Supabase Postgres menjadi db/schema.sql.
//
// Skema sistem ini dibuat langsung di Supabase, bukan lewat file migrasi,
// sehingga semula hanya hidup di dalam proyek Supabase — tidak ada di
// repositori. Script ini mengembalikan skema itu ke dalam repositori supaya
// basis data bisa dibangun ulang dari nol oleh siapa pun.
//
// Jalankan: node scripts/dump-schema.mjs
// Hasil   : db/schema.sql (ditimpa setiap kali dijalankan)

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
}

loadEnvLocal();

const connectionString = process.env.DATABASE_URL_POOLED;
if (!connectionString) {
  console.error("DATABASE_URL_POOLED belum diset di .env.local");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false, max: 1 });

/**
 * Nama ekstensi yang mengandung tanda hubung (mis. uuid-ossp) harus dikutip,
 * kalau tidak pernyataan SQL-nya gagal diurai.
 */
function quoteIdent(name) {
  return /^[a-z_][a-z0-9_]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`;
}

async function main() {
  const out = [];
  out.push("-- Skema basis data JP-Insight");
  out.push("-- Dibangkitkan otomatis oleh scripts/dump-schema.mjs — jangan disunting langsung.");
  out.push(`-- Dibangkitkan pada: ${new Date().toISOString()}`);
  out.push("");

  // --- Ekstensi ---
  const extensions = await sql`
    SELECT extname, n.nspname AS schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE extname NOT IN ('plpgsql')
    ORDER BY extname
  `;
  if (extensions.length > 0) {
    out.push("-- =====================================================");
    out.push("-- Ekstensi");
    out.push("-- =====================================================");
    for (const e of extensions) {
      // Ekstensi bawaan Supabase dibuat otomatis oleh platformnya; dicatat
      // sebagai komentar agar skema ini tetap bisa dipasang di Postgres biasa.
      const bawaanSupabase = ["supabase_vault", "pg_stat_statements"].includes(e.extname);
      const stmt = `CREATE EXTENSION IF NOT EXISTS ${quoteIdent(e.extname)} WITH SCHEMA ${quoteIdent(e.schema)};`;
      out.push(bawaanSupabase ? `-- (disediakan platform Supabase) ${stmt}` : stmt);
    }
    out.push("");
  }

  // --- Tabel ---
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  out.push("-- =====================================================");
  out.push("-- Tabel");
  out.push("-- =====================================================");
  out.push("");

  for (const { table_name } of tables) {
    // Diambil dari pg_catalog, bukan information_schema: hanya format_type yang
    // membawa pengubah tipe secara utuh — information_schema melaporkan
    // vector(384) sebagai "vector" saja sehingga dimensinya hilang diam-diam.
    const columns = await sql`
      SELECT a.attname AS column_name,
             format_type(a.atttypid, a.atttypmod) AS full_type,
             a.attnotnull AS not_null,
             a.attgenerated AS generated,
             pg_get_expr(d.adbin, d.adrelid) AS default_expr
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = ${`public.${table_name}`}::regclass
        AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum
    `;

    const lines = columns.map((c) => {
      let line = `  ${quoteIdent(c.column_name)} ${c.full_type}`;
      if (c.generated === "s") {
        // Kolom terbangkit: ekspresinya bagian dari definisi, bukan nilai awal.
        line += ` GENERATED ALWAYS AS (${c.default_expr}) STORED`;
      } else if (c.default_expr !== null) {
        line += ` DEFAULT ${c.default_expr}`;
      }
      if (c.not_null) line += " NOT NULL";
      return line;
    });

    // Batasan tabel (primary key, unique, foreign key, check) diambil apa
    // adanya dari katalog agar tidak ada aturan integritas yang hilang.
    const constraints = await sql`
      SELECT conname, pg_get_constraintdef(oid) AS definition, contype
      FROM pg_constraint
      WHERE conrelid = ${`public.${table_name}`}::regclass
      ORDER BY CASE contype WHEN 'p' THEN 1 WHEN 'u' THEN 2 WHEN 'f' THEN 3 ELSE 4 END,
               conname
    `;
    for (const c of constraints) {
      lines.push(`  CONSTRAINT ${c.conname} ${c.definition}`);
    }

    out.push(`CREATE TABLE IF NOT EXISTS public.${table_name} (`);
    out.push(lines.join(",\n"));
    out.push(");");
    out.push("");
  }

  // --- Indeks (selain yang dibuat otomatis oleh constraint) ---
  const indexes = await sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname NOT IN (
        SELECT conname FROM pg_constraint WHERE contype IN ('p', 'u')
      )
    ORDER BY tablename, indexname
  `;
  if (indexes.length > 0) {
    out.push("-- =====================================================");
    out.push("-- Indeks");
    out.push("-- =====================================================");
    for (const i of indexes) {
      out.push(`${i.indexdef};`);
    }
    out.push("");
  }

  // --- Fungsi buatan sendiri (mis. helper pencarian) ---
  const functions = await sql`
    SELECT p.proname, pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    ORDER BY p.proname
  `;
  if (functions.length > 0) {
    out.push("-- =====================================================");
    out.push("-- Fungsi");
    out.push("-- =====================================================");
    for (const f of functions) {
      out.push(`${f.definition};`);
      out.push("");
    }
  }

  const target = path.join(process.cwd(), "db", "schema.sql");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, out.join("\n"), "utf-8");

  console.log(`Skema tersimpan di db/schema.sql`);
  console.log(`  tabel   : ${tables.length}`);
  console.log(`  indeks  : ${indexes.length}`);
  console.log(`  ekstensi: ${extensions.length}`);
  console.log(`  fungsi  : ${functions.length}`);

  await sql.end();
}

main().catch(async (err) => {
  console.error("Gagal mengekstrak skema:", err.message);
  process.exit(1);
});

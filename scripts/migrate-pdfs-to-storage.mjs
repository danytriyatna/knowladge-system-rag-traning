// Tahap 4: pindahkan PDF dari storage/pdfs/ (disk lokal) ke Supabase Storage
// bucket "documents-pdfs", lalu update documents.stored_path dari path disk
// jadi object key ("<id>.pdf"). storage/pdfs/ TIDAK dihapus — tetap jadi
// cadangan sampai Tahap 5 (cutover) selesai diverifikasi.

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const content = fsSync.readFileSync(path.join(process.cwd(), ".env.local"), "utf-8");
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

const sql = postgres(process.env.DATABASE_URL_POOLED, { prepare: false });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const BUCKET = "documents-pdfs";

async function main() {
  const documents = await sql`SELECT id, stored_path, filename FROM documents ORDER BY uploaded_at ASC`;
  console.log(`Total dokumen: ${documents.length}`);

  let uploaded = 0;
  let alreadyObjectKey = 0;
  let failed = 0;

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];

    // Sudah berupa object key (bukan path disk absolut) — berarti sudah
    // dimigrasikan sebelumnya (mis. dokumen yang diupload SETELAH lib/storage.ts
    // aktif). Idempotent: lewati saja.
    if (!path.isAbsolute(doc.stored_path)) {
      alreadyObjectKey++;
      continue;
    }

    try {
      const buffer = await fs.readFile(doc.stored_path);
      const objectKey = `${doc.id}.pdf`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(objectKey, buffer, { contentType: "application/pdf", upsert: true });
      if (error) throw new Error(error.message);

      await sql`UPDATE documents SET stored_path = ${objectKey} WHERE id = ${doc.id}`;
      uploaded++;
    } catch (err) {
      failed++;
      console.error(`GAGAL  ${doc.filename} (${doc.id}): ${err.message}`);
    }

    if ((i + 1) % 25 === 0 || i === documents.length - 1) {
      process.stdout.write(`\r  progres: ${i + 1}/${documents.length}`);
    }
  }
  console.log();

  console.log(`\nSelesai: ${uploaded} diupload, ${alreadyObjectKey} sudah object key, ${failed} gagal.`);
  if (failed > 0) process.exitCode = 1;
}

main().finally(async () => {
  await sql.end({ timeout: 5 });
});

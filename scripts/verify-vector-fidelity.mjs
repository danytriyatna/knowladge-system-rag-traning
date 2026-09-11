// Verifikasi Tahap 2: bandingkan cosine similarity versi SQLite (JS manual)
// vs hasil operator pgvector `<=>` di Supabase, untuk ~20 sampel acak.
// Bedanya harus di level pembulatan floating point saja (< 1e-4).

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import postgres from "postgres";

function loadEnvLocal() {
  const content = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf-8");
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

function bufferToVector(buffer) {
  return Array.from(new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4));
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const sqlite = new Database(path.join(process.cwd(), "storage", "db.sqlite"), { readonly: true });
const sql = postgres(process.env.DATABASE_URL_POOLED, { prepare: false });

async function main() {
  const allEmbeddings = sqlite.prepare("SELECT id, chunk_id, vector, dimensions FROM embeddings").all();
  console.log(`Total embeddings di SQLite: ${allEmbeddings.length}`);

  // Ambil 20 sampel acak sebagai "query vector", uji similarity terhadap satu
  // baris lain yang juga acak (bukan dirinya sendiri) supaya bukan skor 1.0 trivial.
  const sample = [];
  for (let i = 0; i < 20; i++) {
    const a = allEmbeddings[Math.floor(Math.random() * allEmbeddings.length)];
    let b = allEmbeddings[Math.floor(Math.random() * allEmbeddings.length)];
    while (b.id === a.id) b = allEmbeddings[Math.floor(Math.random() * allEmbeddings.length)];
    sample.push([a, b]);
  }

  let maxDiff = 0;
  let dimensionMismatches = 0;

  for (const [a, b] of sample) {
    const vecA = bufferToVector(a.vector);
    const vecB = bufferToVector(b.vector);
    if (vecA.length !== 384 || vecB.length !== 384) dimensionMismatches++;
    const jsScore = cosineSimilarity(vecA, vecB);

    // pgvector <=> mengembalikan cosine DISTANCE, similarity = 1 - distance
    const [{ distance }] = await sql`
      SELECT (a.vector <=> b.vector) AS distance
      FROM embeddings a, embeddings b
      WHERE a.id = ${a.id} AND b.id = ${b.id}
    `;
    const pgScore = 1 - Number(distance);
    const diff = Math.abs(jsScore - pgScore);
    maxDiff = Math.max(maxDiff, diff);
    console.log(
      `sqlite=${jsScore.toFixed(6)} pgvector=${pgScore.toFixed(6)} diff=${diff.toExponential(2)}`
    );
  }

  console.log(`\nDimensi tidak 384: ${dimensionMismatches}`);
  console.log(`Selisih maksimum: ${maxDiff.toExponential(2)}`);
  console.log(maxDiff < 1e-4 && dimensionMismatches === 0 ? "LOLOS — vektor setia." : "GAGAL — ada perbedaan signifikan.");
}

main().finally(async () => {
  sqlite.close();
  await sql.end({ timeout: 5 });
});

// Script eksekusi berkala Cron Job untuk sinkronisasi OAI-PMH terbitan OJS Jurnal Permukiman
// Cara pakai: node scripts/cron-sync-ojs.mjs [--limit=N]

import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
loadEnvLocal();

const endpoint = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/sync/ojs`
  : "http://localhost:3001/api/sync/ojs";

const cronSecret = process.env.CRON_SECRET || "";

console.log(`[CRON OJS] Memulai sinkronisasi OAI-PMH via ${endpoint}...`);

async function run() {
  try {
    const headers = { "Content-Type": "application/json" };
    if (cronSecret) {
      headers["Authorization"] = `Bearer ${cronSecret}`;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error(`[CRON OJS] Gagal (${res.status}):`, data.error || data);
      process.exit(1);
    }

    console.log(`[CRON OJS] Selesai dengan status: ${data.status}`);
    console.log(`[CRON OJS] Naskah baru ditemukan: ${data.newDocumentsFound}`);
  } catch (err) {
    console.error("[CRON OJS] Error:", err.message);
    process.exit(1);
  }
}

run();

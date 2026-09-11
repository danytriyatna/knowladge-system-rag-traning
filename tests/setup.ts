import fs from "node:fs";
import path from "node:path";

// @next/env deliberately skips .env.local when NODE_ENV=test (which Vitest
// sets by default) — that's the right default for app code, but here we
// explicitly want the same GEMINI_API_KEY the dev server uses, so live
// accuracy tests exercise the real integration. Minimal manual parser, no
// extra dependency, never overwrites a var that's already set.
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

import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Dinaikkan setelah migrasi ke Supabase: tiap query kini round-trip
    // jaringan (bukan file lokal), jadi tes yang memanggil Gemini + banyak
    // query berturut-turut butuh jendela waktu lebih longgar dari sebelumnya.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "@huggingface/transformers",
    "onnxruntime-node",
    "sharp",
  ],
  // onnxruntime-node dlopen file .so-nya secara dinamis, jadi Output File
  // Tracing Vercel tidak otomatis mendeteksinya sebagai dependency dan
  // meninggalkannya di luar bundle function ("libonnxruntime.so.1: cannot
  // open shared object file"). Disertakan manual untuk semua route API yang
  // (langsung/transitif lewat lib/embedding.ts) bisa memicu embedding lokal.
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**"],
  },
};

export default nextConfig;

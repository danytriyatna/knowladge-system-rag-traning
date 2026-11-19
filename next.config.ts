import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';",
          },
        ],
      },
    ];
  },
  serverExternalPackages: [
    "pdf-parse",
    "@huggingface/transformers",
    "onnxruntime-node",
    "sharp",
  ],
  // onnxruntime-node dlopen file .so-nya secara dinamis, jadi Output File
  // Tracing Vercel tidak otomatis mendeteksinya sebagai dependency dan
  // meninggalkannya di luar bundle function ("libonnxruntime.so.1: cannot
  // open shared object file"). Disertakan manual, HANYA untuk route yang
  // benar-benar import dari lib/embedding.ts (langsung atau lewat
  // lib/harvest.ts) — men-scope ke `/api/**/*` sempat membuat SETIAP route
  // dianggap function terpisah oleh Vercel dan melebihi batas 12 function
  // plan Hobby, karena route lain jadi tidak bisa digabung lagi.
  outputFileTracingIncludes: {
    "/api/chat": ["./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**"],
    "/api/documents/[id]/embeddings": [
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**",
    ],
    "/api/documents/[id]/embeddings/[embeddingId]": [
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**",
    ],
    "/api/sync/ojs": ["./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**"],
  },
};

export default nextConfig;

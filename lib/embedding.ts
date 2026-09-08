import path from "node:path";
import {
  pipeline,
  env,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";

// Model & tensor dijalankan sepenuhnya lokal di server (ONNX Runtime),
// tidak ada panggilan API eksternal. Model didownload sekali lalu di-cache
// di storage/models, jadi setelahnya bisa jalan offline.
env.cacheDir = path.join(process.cwd(), "storage", "models");

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

declare global {
  var __embeddingExtractor: Promise<FeatureExtractionPipeline> | undefined;
}

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!global.__embeddingExtractor) {
    global.__embeddingExtractor = pipeline(
      "feature-extraction",
      EMBEDDING_MODEL
    );
  }
  return global.__embeddingExtractor;
}

/** Embed a batch of texts locally, no external API calls. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const extractor = await getExtractor();
  const results: number[][] = [];
  for (const text of texts) {
    const output = await extractor(text, { pooling: "mean", normalize: true });
    results.push(Array.from(output.data as Float32Array));
  }
  return results;
}

export function vectorToBuffer(vector: number[]): Buffer {
  return Buffer.from(new Float32Array(vector).buffer);
}

export function bufferToVector(buffer: Buffer): number[] {
  return Array.from(
    new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4)
  );
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

import { GoogleGenAI, Type } from "@google/genai";
import type { RetrievedChunk } from "./rag";
import { listEnabledSkills } from "./skills";

const MODEL = process.env.GEMINI_CHAT_MODEL ?? "gemini-3.1-flash-lite";

function buildPrompt(question: string, chunks: RetrievedChunk[]): string {
  const context = chunks
    .map(
      (chunk, i) =>
        `[Sumber ${i + 1} — ${chunk.filename}, bagian ${chunk.chunk_index + 1}]\n${chunk.content}`
    )
    .join("\n\n");

  const skills = listEnabledSkills();
  const skillsSection =
    skills.length > 0
      ? `\nKEMAMPUAN ANALISIS DATA & PENGAMBILAN KESIMPULAN:\nTerapkan kemampuan berikut kalau relevan dengan pertanyaan, tapi tetap wajib berpegang pada ATURAN WAJIB di atas (dilarang berhalusinasi, semua analisis harus berdasar data yang benar-benar ada di konteks):\n${skills
          .map((s) => `- ${s.name}: ${s.instructions}`)
          .join("\n")}\n`
      : "";

  return `Anda adalah asisten yang menjawab pertanyaan pengguna HANYA berdasarkan potongan dokumen (konteks) di bawah ini. Konteks ini diambil dari PDF yang sudah diupload dan diproses pengguna, dan diambil lewat pencarian kemiripan otomatis — sebagian sumber di bawah BISA SAJA tidak benar-benar relevan dengan pertanyaan meskipun ikut muncul di daftar, jadi jangan asumsikan semua sumber pasti berkaitan.

ATURAN WAJIB:
1. Jawab HANYA berdasarkan informasi yang benar-benar ada di dalam konteks. Dilarang keras mengarang, menebak, atau menambahkan informasi yang tidak ada di konteks (jangan berhalusinasi).
2. Jika jawaban tidak ditemukan atau tidak ada satu pun sumber yang relevan dengan pertanyaan, katakan dengan jujur dan sopan bahwa informasinya tidak ditemukan di dokumen yang ada — jangan mengarang jawaban.
3. Susun jawaban dengan bahasa Indonesia yang natural, jelas, ringkas, dan enak dibaca seperti penjelasan manusia — bukan sekadar menyalin mentah potongan teks konteks.
4. Kalau relevan, sebutkan dari dokumen apa informasi itu berasal (gunakan nama file, bukan "Sumber 1/2/3").
5. Tentukan juga nomor sumber (1-based, sesuai penanda [Sumber N] di atas) mana saja yang BENAR-BENAR kamu baca dan pakai untuk menyusun jawaban. Sumber yang topiknya ternyata tidak berkaitan dengan pertanyaan — walau sekilas mirip atau memakai istilah yang sama — WAJIB tidak dimasukkan ke daftar ini. Kalau tidak ada sumber yang relevan sama sekali, kosongkan daftarnya.
${skillsSection}
KONTEKS:
${context}

PERTANYAAN PENGGUNA:
${question}`;
}

export interface ChatAnswer {
  answer: string;
  usedSourceNumbers: number[];
}

export async function answerFromContext(
  question: string,
  chunks: RetrievedChunk[]
): Promise<ChatAnswer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum diset di environment");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildPrompt(question, chunks),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answer: {
            type: Type.STRING,
            description:
              "Jawaban akhir untuk pengguna, bahasa Indonesia natural, hanya berdasarkan konteks yang relevan.",
          },
          used_source_numbers: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description:
              "Nomor sumber (1-based) yang benar-benar relevan dan dipakai untuk menjawab. Kosongkan jika tidak ada yang relevan.",
          },
        },
        required: ["answer", "used_source_numbers"],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini tidak mengembalikan jawaban");
  }

  let parsed: { answer?: unknown; used_source_numbers?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini mengembalikan format jawaban yang tidak valid");
  }

  if (typeof parsed.answer !== "string") {
    throw new Error("Gemini mengembalikan format jawaban yang tidak valid");
  }

  const usedSourceNumbers = Array.isArray(parsed.used_source_numbers)
    ? parsed.used_source_numbers.filter((n): n is number => typeof n === "number")
    : [];

  return { answer: parsed.answer.trim(), usedSourceNumbers };
}

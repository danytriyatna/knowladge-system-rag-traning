import { describe, expect, it } from "vitest";
import {
  validSourceNumbers,
  NO_SOURCE_ANSWER,
  formatCitationSnippet,
  dedupeCitationsByDocument,
  buildChatSourceCitation,
} from "@/lib/citation";

/**
 * Pagar sitasi adalah penegakan syarat "tidak ada jawaban tanpa sumber".
 * Sebelum ini, syarat tersebut hanya bergantung pada kepatuhan model terhadap
 * prompt — 8 dari 28 percakapan di riwayat tersimpan dengan sources kosong.
 */
describe("validSourceNumbers", () => {
  it("mempertahankan nomor sumber yang menunjuk konteks nyata", () => {
    expect(validSourceNumbers([1, 3, 5], 8)).toEqual([1, 3, 5]);
  });

  it("membuang nomor di luar rentang konteks", () => {
    // Model menyebut [Sumber 12] padahal konteks hanya berisi 8 potongan.
    expect(validSourceNumbers([1, 12, 99], 8)).toEqual([1]);
  });

  it("membuang nol, negatif, dan bilangan pecahan", () => {
    expect(validSourceNumbers([0, -2, 2.5, 3], 8)).toEqual([3]);
  });

  it("menggabungkan nomor yang disebut berulang", () => {
    expect(validSourceNumbers([2, 2, 2], 8)).toEqual([2]);
  });

  it("mengembalikan daftar kosong saat tidak ada konteks sama sekali", () => {
    expect(validSourceNumbers([1, 2], 0)).toEqual([]);
  });

  it("menyediakan jawaban baku yang tidak mengarang apa pun", () => {
    expect(NO_SOURCE_ANSWER).toMatch(/tidak ditemukan/i);
  });
});

describe("dedupeCitationsByDocument", () => {
  it("menggabungkan beberapa chunk dari dokumen yang sama dan memilih similarity tertinggi", () => {
    const input = [
      { document_id: "doc-info", chunk_index: 2, similarity: 0.71, title: "Profil JP-Insight", snippet: "Chunk 2" },
      { document_id: "doc-ojs", chunk_index: 0, similarity: 0.74, title: "Panduan Penulis", snippet: "OJS 0" },
      { document_id: "doc-info", chunk_index: 0, similarity: 0.86, title: "Profil JP-Insight", snippet: "Chunk 0" },
      { document_id: "doc-info", chunk_index: 1, similarity: 0.86, title: "Profil JP-Insight", snippet: "Chunk 1" },
    ];

    const deduped = dedupeCitationsByDocument(input);
    expect(deduped).toHaveLength(2);
    expect(deduped[0]).toMatchObject({ document_id: "doc-info", chunk_index: 0, similarity: 0.86 });
    expect(deduped[1]).toMatchObject({ document_id: "doc-ojs", chunk_index: 0 });
  });

  it("tetap memisahkan sumber dengan title sama bila document_id berbeda", () => {
    const deduped = dedupeCitationsByDocument([
      { document_id: "doc-1", chunk_index: 0, similarity: 0.8, title: "Artikel A" },
      { document_id: "doc-2", chunk_index: 0, similarity: 0.7, title: "Artikel A" },
    ]);
    expect(deduped).toHaveLength(2);
  });
});

describe("formatCitationSnippet", () => {
  it("menghapus penanda heading markdown dan merapikan potongan overlap pada chunk lanjutan", () => {
    const chunkText =
      "n editor, pengumuman, dan cara pendaftaran).\n- Dokumentasi profil dan panduan resmi JP-Insight.\n\n## Aturan Anti-Halusinasi, Sitasi, dan Keamanan Data\nJP-Insight menerapkan aturan pagar sitasi mutlak di tingkat kode: tidak ada jawaban tanpa sumber yang terverifikasi.";

    const snippet = formatCitationSnippet(chunkText, 200, 3);
    expect(snippet.startsWith("n editor")).toBe(false);
    expect(snippet).not.toContain("##");
    expect(snippet).toMatch(/^Dokumentasi profil/);
    expect(snippet.endsWith("...")).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(203);
  });

  it("mempertahankan awal kalimat pada chunk pertama dan membersihkan markdown heading", () => {
    const chunkText =
      "Profil Resmi dan Panduan JP-Insight\n\n## Apa Itu JP-Insight?\nJP-Insight adalah asisten cerdas berbasis korpus **Jurnal Permukiman**.";
    const snippet = formatCitationSnippet(chunkText, 220, 0);
    expect(snippet).toContain("Profil Resmi dan Panduan JP-Insight. Apa Itu JP-Insight?");
    expect(snippet).not.toContain("**");
    expect(snippet).not.toContain("##");
  });
});

describe("buildChatSourceCitation", () => {
  it("membangun sitasi lengkap dengan article_url dan snippet bersih", () => {
    const citation = buildChatSourceCitation(
      {
        document_id: "doc-123",
        filename: "artikel.pdf",
        chunk_index: 0,
        content: "## Ringkasan\nPengujian beton berpori untuk perkerasan ramah lingkungan.",
        similarity: 0.88,
        title: "Beton Berpori Ramah Lingkungan",
        authors: "Siti Aminah",
        published_year: 2024,
        volume: "19",
        issue_number: "1",
        doi: "10.31284/jp.2024.1",
        ojs_article_id: 456,
        source: "ojs_harvest",
        source_url: null,
      },
      "http://localhost:8000/index.php/JP/article/view"
    );

    expect(citation.article_url).toBe("http://localhost:8000/index.php/JP/article/view/456");
    expect(citation.snippet).toBe("Ringkasan — Pengujian beton berpori untuk perkerasan ramah lingkungan.");
  });

  it("mengisi tautan fallback halaman publik /panduan untuk sumber jp_insight_info tanpa source_url", () => {
    const citation = buildChatSourceCitation(
      {
        document_id: "doc-info",
        filename: "jp-insight-profil-dan-panduan.pdf",
        chunk_index: 0,
        content: "## Apa Itu JP-Insight?\nAsisten cerdas Jurnal Permukiman.",
        similarity: 0.72,
        title: "Profil Resmi, Cara Kerja, dan Panduan JP-Insight",
        source: "jp_insight_info",
        source_url: null,
      },
      "http://localhost:8000/index.php/JP/article/view",
      "http://localhost:3001"
    );

    expect(citation.source_url).toBe("http://localhost:3001/panduan");
  });
});

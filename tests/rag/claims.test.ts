import { describe, expect, it } from "vitest";
import { isGapCandidate, findGapCandidates } from "@/lib/claims";
import { countEmbeddings } from "@/lib/rag";

/**
 * Penyaring kandidat sengaja longgar: tugasnya memangkas 8.589 potongan
 * menjadi puluhan, bukan memutuskan mana yang benar-benar celah riset.
 * Keputusan itu ada di tahap LLM, yang hasilnya masih diverifikasi lagi
 * terhadap teks aslinya.
 */
describe("isGapCandidate", () => {
  it("menangkap penanda saran penelitian lanjutan", () => {
    expect(
      isGapCandidate("Saran bagi penelitian selanjutnya adalah perlunya pemetaan yang lebih detil.")
    ).toBe(true);
    expect(isGapCandidate("Hal ini perlu dikaji lebih lanjut pada studi berikutnya.")).toBe(true);
  });

  it("menangkap penanda keterbatasan penelitian", () => {
    expect(
      isGapCandidate("Penelitian mengenai efisiensi penyerapan logam berat masih terbatas.")
    ).toBe(true);
    expect(isGapCandidate("Topik ini belum banyak diteliti di Indonesia.")).toBe(true);
  });

  it("melewatkan potongan tanpa penanda sama sekali", () => {
    expect(
      isGapCandidate("Hasil pengujian kuat tekan beton menunjukkan nilai 25 MPa pada umur 28 hari.")
    ).toBe(false);
  });

  it("penyaring longgar: keterbatasan program ikut lolos sebagai KANDIDAT", () => {
    // Ini memang bukan celah riset, dan penolakannya adalah tugas LLM.
    // Tes ini mengunci pembagian tanggung jawab tersebut secara eksplisit,
    // supaya tidak ada yang mencoba "memperbaiki" regex agar memutuskan.
    expect(
      isGapCandidate("Program pembangunan ini masih terbatas pada sarana mandi, cuci, kakus.")
    ).toBe(true);
  });
});

describe("findGapCandidates (korpus produksi)", () => {
  it("memangkas korpus menjadi sebagian kecil saja", async () => {
    if ((await countEmbeddings()) === 0) return;

    const candidates = await findGapCandidates();
    expect(candidates.length).toBeGreaterThan(0);
    // Kalau penyaring tiba-tiba meloloskan sebagian besar korpus, biaya panen
    // meledak — batas ini menjaga hal itu ketahuan lebih dulu.
    expect(candidates.length).toBeLessThan(500);
    for (const c of candidates) {
      expect(isGapCandidate(c.content)).toBe(true);
    }
  });
});

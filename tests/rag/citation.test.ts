import { describe, expect, it } from "vitest";
import { validSourceNumbers, NO_SOURCE_ANSWER } from "@/lib/citation";

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

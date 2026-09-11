import { describe, expect, it } from "vitest";
import { evidenceStrengthFor, combineWeakestLink } from "@/lib/evidence";

describe("evidenceStrengthFor", () => {
  it("mengembalikan 'kuat' untuk 3 naskah berbeda atau lebih", () => {
    expect(evidenceStrengthFor(3)).toBe("kuat");
    expect(evidenceStrengthFor(5)).toBe("kuat");
  });

  it("mengembalikan 'sedang' untuk tepat 2 naskah berbeda", () => {
    expect(evidenceStrengthFor(2)).toBe("sedang");
  });

  it("mengembalikan 'lemah' untuk 1 naskah atau 0 naskah", () => {
    expect(evidenceStrengthFor(1)).toBe("lemah");
    expect(evidenceStrengthFor(0)).toBe("lemah");
  });
});

describe("combineWeakestLink", () => {
  it("mengembalikan null untuk daftar kosong (tidak ada klaim)", () => {
    expect(combineWeakestLink([])).toBeNull();
  });

  it("mengikuti klaim paling lemah, bukan rata-rata atau mayoritas", () => {
    // Banyak klaim kuat, tapi satu klaim cuma didukung 1 naskah -> keseluruhan lemah.
    expect(combineWeakestLink(["kuat", "kuat", "kuat", "lemah"])).toBe("lemah");
    expect(combineWeakestLink(["kuat", "sedang"])).toBe("sedang");
    expect(combineWeakestLink(["kuat", "kuat"])).toBe("kuat");
  });

  it("tidak terpengaruh urutan klaim", () => {
    expect(combineWeakestLink(["lemah", "kuat", "sedang"])).toBe("lemah");
    expect(combineWeakestLink(["sedang", "kuat", "kuat"])).toBe("sedang");
  });
});

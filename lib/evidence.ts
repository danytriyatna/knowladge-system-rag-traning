import type { EvidenceStrength } from "./db";

const STRENGTH_RANK: Record<EvidenceStrength, number> = { lemah: 1, sedang: 2, kuat: 3 };

/** Kekuatan bukti satu klaim, berdasarkan berapa naskah berbeda yang mendukungnya. */
export function evidenceStrengthFor(distinctDocCount: number): EvidenceStrength {
  if (distinctDocCount >= 3) return "kuat";
  if (distinctDocCount === 2) return "sedang";
  return "lemah";
}

/**
 * Kekuatan bukti keseluruhan kajian mengikuti klaim yang PALING LEMAH
 * (weakest link) — supaya tidak overclaim hanya karena total naskah yang
 * tersentuh di seluruh kajian kebetulan banyak.
 */
export function combineWeakestLink(strengths: EvidenceStrength[]): EvidenceStrength | null {
  if (strengths.length === 0) return null;
  return strengths.reduce((weakest, current) =>
    STRENGTH_RANK[current] < STRENGTH_RANK[weakest] ? current : weakest
  );
}

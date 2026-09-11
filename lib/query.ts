/**
 * Pembacaan maksud pertanyaan + perluasan istilah domain ke-PU-an.
 *
 * Sengaja berbasis aturan, bukan LLM: keputusannya cuma "aktifkan jalur
 * pencarian peraturan atau tidak", dan itu tidak sebanding dengan biaya serta
 * latensi satu panggilan model tambahan di setiap pertanyaan.
 */

/**
 * Penanda bahwa penanya sedang mencari dasar aturan, bukan temuan riset.
 * "standar"/"persyaratan" ikut masuk karena di bidang PU keduanya hampir
 * selalu merujuk SNI atau pedoman teknis.
 */
const NORMATIVE_MARKERS =
  /\b(peraturan|aturan|regulasi|permen|permenpu|pupr|sni|undang[-\s]?undang|perpres|kepmen|nspk|pedoman|persyaratan|standar|ketentuan|wajib|diwajibkan|mandatory|diatur|mengatur|legal|pasal)\b/i;

export function isNormativeQuestion(question: string): boolean {
  return NORMATIVE_MARKERS.test(question);
}

/**
 * Sinonim & singkatan yang lazim dipakai bergantian di naskah bidang PU.
 * Tanpa ini, pertanyaan yang memakai istilah panjang tidak pernah bertemu
 * naskah yang konsisten memakai singkatannya (atau sebaliknya).
 */
const DOMAIN_SYNONYMS: Record<string, string[]> = {
  "bangunan gedung hijau": ["BGH", "green building", "bangunan hijau"],
  "bangunan hijau": ["BGH", "green building", "bangunan gedung hijau"],
  bgh: ["bangunan gedung hijau", "green building"],
  "air minum": ["SPAM", "penyediaan air minum", "air bersih"],
  spam: ["sistem penyediaan air minum", "air minum"],
  "air limbah": ["IPAL", "sanitasi", "limbah domestik"],
  ipal: ["instalasi pengolahan air limbah", "air limbah"],
  sampah: ["persampahan", "TPA", "TPS3R", "TPST"],
  "rumah susun": ["rusun", "rusunawa", "hunian vertikal"],
  rusun: ["rumah susun", "rusunawa", "hunian vertikal"],
  risha: ["rumah instan sederhana sehat"],
  "tahan gempa": ["ketahanan gempa", "seismik", "kegempaan"],
  "kawasan kumuh": ["permukiman kumuh", "kumuh"],
  "ruang terbuka hijau": ["RTH"],
  rth: ["ruang terbuka hijau"],
  "efisiensi energi": ["konservasi energi", "penghematan energi", "OTTV"],
  drainase: ["zero run off", "limpasan"],
};

/**
 * Tambahkan sinonim domain ke teks pertanyaan untuk keperluan pencarian kata
 * kunci. Hasilnya HANYA dipakai sebagai bahan query FTS — pertanyaan asli
 * pengguna tetap yang dikirim ke model.
 */
export function expandQueryTerms(question: string): string {
  const lower = question.toLowerCase();
  const extras: string[] = [];

  for (const [term, synonyms] of Object.entries(DOMAIN_SYNONYMS)) {
    if (lower.includes(term)) extras.push(...synonyms);
  }

  if (extras.length === 0) return question;
  return `${question} ${Array.from(new Set(extras)).join(" ")}`;
}

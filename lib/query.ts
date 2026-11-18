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

const ASSISTANT_IDENTITY_PATTERNS: RegExp[] = [
  /\b(?:siapa(?:\s+(?:sih|nih|ya|itu|ini))?\s+(?:kamu|anda|kau|engkau|dirimu|namamu|bot(?:\s+ini)?|asisten(?:\s+ini)?))\b/i,
  /\b(?:(?:kamu|anda|dirimu|asisten(?:\s+ini)?|bot(?:\s+ini)?)\s+(?:ini\s+)?siapa)\b/i,
  /\b(?:(?:kamu|anda|bot(?:\s+ini)?|asisten(?:\s+ini)?)\s+(?:ini\s+)?apa)\b/i,
  /\b(?:apa\s+(?:tugas|fungsi|peran|kegunaan|kemampuan)(?:mu|\s+(?:kamu|anda|asisten|bot)))\b/i,
  /\b(?:(?:kamu|anda)\s+(?:bisa|dapat)\s+(?:bantu|melakukan)\s+apa)\b/i,
  /\b(?:perkenalkan|kenalkan)\s+diri(?:mu|\s+(?:kamu|anda))?\b/i,
  /\b(?:ceritakan\s+)?tentang\s+(?:kamu|anda|dirimu)\b/i,
  /\b(?:who\s+are\s+you|what\s+are\s+you|introduce\s+yourself|tell\s+me\s+about\s+yourself)\b/i,
];

/**
 * Mengenali pertanyaan perkenalan atau identitas asisten (mis. "siapa kamu?",
 * "siapa anda?", "apa tugasmu?") agar sistem menarik profil resmi JP-Insight
 * tanpa memicu pertanyaan riset seperti "siapa penulis artikel...".
 */
export function isAssistantIdentityQuestion(question: string): boolean {
  const normalized = question.trim();
  if (!normalized) return false;
  return ASSISTANT_IDENTITY_PATTERNS.some((pattern) => pattern.test(normalized));
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
  "biaya submit": ["article processing charge", "apc", "gratis", "publikasi", "biaya"],
  "biaya publikasi": ["article processing charge", "apc", "gratis"],
  apc: ["article processing charge", "biaya publikasi", "biaya submit"],
  "daftar akun": ["registration", "register", "registrasi", "jurnalpermukiman@pu.go.id"],
  "cara daftar": ["registration", "register", "registrasi", "jurnalpermukiman@pu.go.id"],
  registrasi: ["registration", "register", "daftar akun"],
  "panduan submit": ["author guidelines", "submissions", "panduan penulis", "hak cipta", "copyright"],
  "submit naskah": ["submissions", "author guidelines", "panduan penulis", "copyright"],
  "jp-insight": ["insight", "asisten cerdas", "sistem pengetahuan", "jurnal permukiman"],
  "jp insight": ["jp-insight", "insight", "asisten cerdas"],
  mqc: ["manuscript quality check", "gaya selingkung", "pra-telaah"],
  "ruang lingkup": ["aims and scope", "focus and scope", "fokus"],
  "etika publikasi": ["publication ethics", "plagiarism", "retraction"],
  review: ["peer review", "kebijakan review", "mitra bestari"],
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

  if (isAssistantIdentityQuestion(question)) {
    extras.push("JP-Insight", "asisten cerdas", "sistem pengetahuan", "profil resmi");
  }

  if (extras.length === 0) return question;
  return `${question} ${Array.from(new Set(extras)).join(" ")}`;
}

/**
 * Pagar sitasi — menegakkan satu syarat mutlak sistem ini: tidak ada jawaban
 * tanpa sumber.
 *
 * Sebelumnya syarat itu hanya diimbau lewat prompt, sehingga bergantung pada
 * kepatuhan model. Di sini ia jadi jaminan kode.
 */

/** Jawaban baku ketika tidak ada satu pun sumber yang bisa menopang jawaban. */
export const NO_SOURCE_ANSWER =
  "Informasi yang diminta tidak ditemukan di dokumen yang tersedia.";

/**
 * Buang nomor sumber yang tidak menunjuk konteks mana pun.
 *
 * Model kadang mengarang indeks sitasi (menyebut [Sumber 12] padahal konteks
 * hanya berisi 8), atau mengembalikan nilai non-integer. Sitasi seperti itu
 * tidak bisa diverifikasi siapa pun dan harus gugur sebelum dipakai.
 */
export function validSourceNumbers(
  numbers: number[],
  chunkCount: number
): number[] {
  return Array.from(new Set(numbers)).filter(
    (n) => Number.isInteger(n) && n >= 1 && n <= chunkCount
  );
}

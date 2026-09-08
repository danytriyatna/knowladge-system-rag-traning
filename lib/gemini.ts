import {
  GoogleGenAI,
  createPartFromBase64,
  createUserContent,
  PartMediaResolutionLevel,
} from "@google/genai";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

const PROMPT = `Baca seluruh isi dokumen PDF ini halaman demi halaman, lalu keluarkan hasilnya dalam format berikut untuk setiap halaman:

--- Halaman <nomor> ---
<isi halaman>

Aturan penulisan isi halaman:
1. Teks biasa (judul, paragraf, daftar): transkrip apa adanya sesuai urutan aslinya, jangan diringkas.
2. TABEL yang berisi data (angka, kategori, perbandingan, statistik, dsb): lakukan DUA hal berikut, bukan cuma salah satu:
   a. Salin ulang tabelnya apa adanya dalam format markdown table, supaya strukturnya (baris/kolom, header) tetap terjaga persis seperti aslinya.
   b. WAJIB tambahkan narasi lengkap setelah tabel tersebut, dalam bentuk kalimat/paragraf biasa (bukan poin-poin), yang menjelaskan isi tabel itu apa adanya: sebutkan nilai-nilai pentingnya satu per satu beserta baris/kategori yang bersangkutan, nilai tertinggi dan terendah beserta baris mana yang punya nilai itu, totalnya kalau ada baris total, dan hubungan/perbandingan antar baris atau kolom yang terlihat dari angkanya. Narasi ini harus murni berdasarkan angka yang ada di tabel, tanpa opini atau kesimpulan tambahan.
   Tujuannya supaya isi tabel tetap bisa ditemukan dan dipahami lewat pencarian teks biasa, tanpa harus membaca ulang tabelnya.
3. Peta, grafik, diagram, infografis, atau gambar lain yang membawa informasi: JANGAN hanya menyebut "terdapat peta/gambar". Jelaskan secara rinci dan terstruktur dalam bentuk poin-poin:
   - Judul/topik gambar tersebut.
   - Arti setiap warna/simbol pada legenda.
   - Untuk peta wilayah berwarna: sebutkan satu per satu nama wilayah/daerah yang terlihat beserta kategori warna/nilai yang ditunjukkan untuknya.
   - Ikon atau penanda khusus (misal lokasi infrastruktur) beserta labelnya.
   - Skala, arah mata angin, atau catatan sumber data jika ada.
   Tujuannya agar pembaca teks ini bisa memahami isi gambar sepenuhnya tanpa perlu melihat gambar aslinya.
4. Jangan menambahkan opini, kesimpulan, atau informasi yang tidak benar-benar terlihat di dokumen.
5. Jika kualitas gambar/tabel buram/pecah/resolusi rendah sehingga ada bagian yang sulit dibaca:
   - Tetap lakukan pembacaan sebaik mungkin, gunakan konteks di sekitarnya (legenda, label berdekatan, pola pin/marker, header kolom lain, teks lain di halaman yang sama) untuk membantu menebak nilai yang paling mungkin.
   - Untuk peta dengan banyak pin/marker kecil (misal titik lokasi infrastruktur), kelompokkan berdasarkan warna/jenis pin dan sebutkan estimasi jumlah serta area sebarannya per warna jika satu per satu tidak bisa dibedakan karena buram.
   - Untuk bagian yang benar-benar tidak bisa dibaca meskipun sudah diusahakan, tulis "[tidak terbaca jelas]" pada bagian itu saja, jangan melewatkannya diam-diam dan jangan mengarang isinya.`;

export async function extractTextWithGemini(buffer: Buffer): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum diset di environment");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: createUserContent([
      PROMPT,
      createPartFromBase64(
        buffer.toString("base64"),
        "application/pdf",
        PartMediaResolutionLevel.MEDIA_RESOLUTION_HIGH
      ),
    ]),
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini tidak mengembalikan teks apa pun");
  }
  return text;
}

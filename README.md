# JP-Insight

Sistem referensi dan pendukung keputusan berbasis korpus Jurnal Permukiman,
bidang Pekerjaan Umum. Membantu peneliti dan penulis naskah menemukan temuan
riset terdahulu, menelusuri peraturan yang dirujuk, dan melihat celah riset
yang masih terbuka — seluruhnya disertai sumber yang dapat ditelusuri.

Dokumen untuk pimpinan dan pengadaan ada di [`docs/`](docs/).

---

## Aturan yang mengikat seluruh sistem

> **Tidak ada jawaban tanpa sumber.**
> Bila tidak ada naskah pendukung, sistem menyatakan informasi tidak ditemukan —
> bukan mengarang jawaban.

Aturan ini **ditegakkan di kode**, bukan sekadar diinstruksikan ke model bahasa.
Lihat [`lib/citation.ts`](lib/citation.ts) dan pagar di
[`app/api/chat/route.ts`](app/api/chat/route.ts). Jangan melonggarkannya saat
menambah fitur — seluruh nilai sistem ini bertumpu padanya.

---

## Menyiapkan lingkungan pengembangan

### Prasyarat

- Node.js 20 atau lebih baru
- Proyek Supabase (Postgres + Storage)
- API key Google Gemini

### Langkah

```bash
npm install
cp .env.local.example .env.local   # lalu isi nilainya
npm run dev
```

Baca [`.env.local.example`](.env.local.example) — setiap variabel dijelaskan di
sana, termasuk cara membangkitkan `SESSION_SECRET`.

### Menyiapkan basis data dari nol

Skema lengkap ada di [`db/schema.sql`](db/schema.sql). Jalankan isinya pada SQL
Editor Supabase, atau:

```bash
psql "$DATABASE_URL_POOLED" -f db/schema.sql
```

Lalu buat bucket Storage bernama `documents-pdfs` (private).

Skema dibangkitkan dari basis data yang berjalan. Setelah mengubah struktur
tabel, perbarui berkasnya:

```bash
node scripts/dump-schema.mjs
```

### Akun pertama

Isi `ADMIN_EMAIL` dan `ADMIN_PASSWORD` di `.env.local`, lalu coba login. Akun
administrator dibuat otomatis **hanya bila tabel `users` masih kosong**. Ganti
kata sandinya setelah berhasil masuk.

---

## Perintah

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Menjalankan server pengembangan |
| `npm run build` | Membangun untuk produksi |
| `npm test` | Menjalankan seluruh pengujian |
| `npm run lint` | Memeriksa gaya penulisan kode |
| `node scripts/dump-schema.mjs` | Memperbarui `db/schema.sql` dari basis data |

Sebagian pengujian memanggil Gemini dan korpus produksi sungguhan. Tanpa
`GEMINI_API_KEY`, pengujian tersebut dilewati otomatis, bukan digagalkan.

---

## Peta kode

```
app/
  (app)/            Halaman aplikasi (dokumen, chat, peraturan, celah riset)
  api/              Antarmuka layanan
  components/       Komponen antarmuka
lib/
  db.ts             Koneksi Postgres + definisi tipe data
  storage.ts        Penyimpanan berkas PDF (Supabase Storage)
  auth.ts           Autentikasi, sesi, peran, log audit
  rag.ts            Pencarian hibrida: vektor + teks penuh + jalur peraturan
  embedding.ts      Pembentukan embedding (ONNX, berjalan lokal)
  chat.ts           Penyusunan jawaban dan kajian
  citation.ts       Pagar sitasi — penegak aturan "tidak ada jawaban tanpa sumber"
  query.ts          Pembacaan maksud pertanyaan + sinonim domain PU
  regulations.ts    Pemanenan dan penelusuran rujukan peraturan
  claims.ts         Pemanenan pernyataan celah riset
  harvest.ts, ojs.ts  Sinkronisasi terbitan dari arsip jurnal (OAI-PMH)
  pdf.ts, docx.ts, gemini.ts  Ekstraksi teks naskah
db/schema.sql       Skema basis data
scripts/            Alat sekali jalan (migrasi, ekstraksi skema, verifikasi)
tests/rag/          Pengujian otomatis
docs/               Dokumen roadmap, SDLC, proses bisnis, paparan
```

---

## Keputusan rancangan yang perlu diketahui

Hal-hal berikut tampak janggal bila dibaca sepintas, tetapi ada alasannya.
Mengubahnya tanpa memahami alasannya akan merusak perilaku sistem.

**Nomor peraturan dipungut dengan regex, bukan model bahasa.**
Nomor peraturan harus persis — satu digit bergeser berarti menunjuk aturan yang
sama sekali lain, dan model bahasa rawan menggeser digit. Lihat
[`lib/regulations.ts`](lib/regulations.ts).

**Pencarian memakai tiga jalur, bukan satu.**
Kemiripan makna, pencocokan kata kunci, dan jalur khusus potongan bermuatan
peraturan. Model embedding yang dipakai dilatih untuk bahasa Inggris sehingga
skor kemiripannya pada teks Indonesia sering rata dan tidak membedakan —
jalur kata kunci yang menyelamatkan. Lihat [`lib/rag.ts`](lib/rag.ts).

**Jalur peraturan memilih naskah dulu, baru potongan.**
Pencarian kata kunci biasa memenangkan potongan abstrak yang mengulang istilah
belasan kali, sementara kalimat yang benar-benar menyebut dasar hukum hanya
menyebut istilah itu sekali.

**Kutipan hasil model diverifikasi ke teks asli.**
Pada pemanenan celah riset, kutipan yang dikembalikan model dicocokkan ke teks
naskah; yang tidak cocok digugurkan. Lihat [`lib/claims.ts`](lib/claims.ts).

**Pemanenan celah riset diberi jeda antar panggilan.**
Tanpa jeda dan mundur bertahap, kuota per menit habis dan sebagian besar
potongan gagal diproses.

**Pool koneksi Postgres dibatasi `max: 1`.**
Sesuai anjuran Supabase untuk lingkungan tanpa server: tiap cold start membuat
instance baru, dan pool bawaan menumpuk lintas cold start sampai slot koneksi
habis. Lihat [`lib/db.ts`](lib/db.ts).

**Deteksi edisi lama bukan pernyataan pencabutan.**
Sistem hanya mengetahui bahwa ada edisi lebih baru di dalam korpus, bukan
status resmi suatu peraturan. Jangan mengubah kalimatnya menjadi lebih tegas.

---

## Batas yang tidak boleh dilanggar

- Jawaban tanpa sumber tidak boleh sampai ke pengguna.
- Sistem tidak boleh menyatakan suatu topik "belum pernah diteliti" — hanya
  bahwa topik itu tidak ditemukan dalam korpus yang dimilikinya.
- Kutipan peraturan dari dalam naskah harus dinyatakan sebagai kutipan, tidak
  boleh tampil seolah sistem membaca teks peraturannya langsung.
- Tautan sumber peraturan hanya boleh menunjuk situs JDIH resmi yang terdaftar.
- `SUPABASE_SERVICE_ROLE_KEY` hanya boleh dipakai di sisi server.

---

## Arah pengembangan

Roadmap lengkap beserta status tiap tahap ada di
[`docs/ROADMAP-KNOWLEDGE-BASE.md`](docs/ROADMAP-KNOWLEDGE-BASE.md).

# Daftar Serah Terima Sistem JP-Insight

Panduan menyerahkan sistem kepada pihak ketiga yang akan melanjutkan
pengembangan. Diisi dan diperiksa bersama kedua belah pihak.

| | |
| --- | --- |
| Diserahkan oleh | |
| Diterima oleh | |
| Tanggal | |

---

## 1. Keamanan — kerjakan lebih dulu

> **Jangan menyerahkan berkas `.env.local`.**
> Berkas itu memuat kunci yang memberi akses penuh ke basis data, penyimpanan
> berkas, dan kuota layanan model bahasa. Menyerahkannya sama dengan
> menyerahkan seluruh kendali sistem secara permanen — termasuk setelah
> kontrak berakhir.

Yang benar: pihak ketiga diberi **kredensial baru atas nama mereka sendiri**,
sehingga dapat dicabut sewaktu-waktu tanpa mengganggu sistem berjalan.

### Kredensial yang wajib diterbitkan ulang atau dibuatkan baru

| Kredensial | Tindakan | Alasan |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Terbitkan ulang setelah serah terima | Melewati seluruh pembatasan akses baris |
| Kata sandi basis data | Ganti, berikan yang baru | Akses penuh ke seluruh data |
| `GEMINI_API_KEY` | Buat kunci terpisah untuk pihak ketiga | Kuota dan biaya terpisah, mudah dicabut |
| `SESSION_SECRET` | **Jangan disamakan** antara lingkungan | Nilai berbeda untuk pengembangan dan produksi |
| `ADMIN_PASSWORD` | Buat akun administrator terpisah | Jejak audit tetap dapat dibedakan |

### Pemisahan lingkungan

Sangat dianjurkan pihak ketiga bekerja pada **proyek Supabase terpisah**, bukan
pada basis data produksi. Skema dapat dibangun ulang dari `db/schema.sql`, dan
korpus naskah dapat diisi ulang melalui sinkronisasi arsip jurnal.

Bila pihak ketiga tetap memerlukan akses ke produksi, berikan hanya akses baca,
dan catat alasannya.

---

## 2. Yang diserahkan

### 2.1 Kode sumber

- [ ] Akses repositori git beserta seluruh riwayatnya
- [ ] Hak membuat cabang; penggabungan ke cabang utama tetap melalui peninjauan

Riwayat git memuat alasan di balik banyak keputusan teknis. Jangan menyerahkan
salinan folder tanpa riwayat.

### 2.2 Dokumentasi

| Berkas | Isi |
| --- | --- |
| `README.md` | Cara menyiapkan, menjalankan, peta kode, keputusan rancangan |
| `.env.local.example` | Seluruh variabel lingkungan beserta penjelasannya |
| `db/schema.sql` | Skema basis data lengkap |
| `docs/ROADMAP-KNOWLEDGE-BASE.md` | Arah pengembangan dan status tiap tahap |
| `docs/Proses-Bisnis-JP-Insight.docx` | Proses bisnis, SSO, fitur, sumber data |
| `docs/SDLC-JP-Insight.docx` | Dokumen pengembangan sistem |
| `docs/JP-Insight-Paparan.pptx` | Bahan paparan |

### 2.3 Akses layanan

- [ ] Proyek Supabase — undang sebagai anggota, jangan berbagi kata sandi akun
- [ ] Platform hosting — undang ke proyek, jangan berbagi akun
- [ ] Kunci API model bahasa — kunci terpisah atas nama pihak ketiga

### 2.4 Data

- [ ] Konfirmasi korpus naskah lengkap dan dapat dibaca
- [ ] Konfirmasi pencadangan terakhir berhasil dan dapat dipulihkan

Isi basis data per 29 Oktober 2026: 210 naskah, 8.589 potongan teks beserta
indeksnya, 786 rujukan peraturan, 111 pernyataan celah riset, 109 catatan audit.

---

## 3. Yang tidak diserahkan

- [ ] Berkas `.env.local` beserta seluruh isinya
- [ ] Kata sandi akun milik pemberi kerja
- [ ] Kredensial produksi yang masih berlaku

---

## 4. Verifikasi penerimaan

Pihak ketiga dinyatakan siap bekerja bila seluruh langkah berikut berhasil
**di lingkungan mereka sendiri**, bukan didemonstrasikan oleh pemberi kerja.

- [ ] `npm install` selesai tanpa galat
- [ ] Basis data terbangun dari `db/schema.sql`
- [ ] Bucket penyimpanan `documents-pdfs` dibuat
- [ ] `npm run dev` berjalan dan halaman login terbuka
- [ ] Berhasil masuk menggunakan akun administrator
- [ ] Berhasil mengunggah satu naskah dan memprosesnya sampai terindeks
- [ ] Pertanyaan di dalam cakupan korpus dijawab **disertai sumber**
- [ ] Pertanyaan di luar cakupan korpus dijawab **"tidak ditemukan"**
- [ ] `npm test` lulus seluruhnya
- [ ] `npm run build` berhasil

Dua butir pengujian jawaban bukan formalitas. Keduanya memastikan pagar
ketertelusuran sumber masih bekerja di lingkungan yang baru.

---

## 5. Pengarahan teknis

Agenda pertemuan serah terima teknis:

1. Aturan yang mengikat seluruh sistem — mengapa tidak boleh ada jawaban tanpa
   sumber, dan di mana aturan itu ditegakkan dalam kode
2. Alur pengolahan naskah: dari unggah sampai dapat dicari
3. Cara kerja pencarian tiga jalur dan alasan tidak memakai satu jalur saja
4. Keputusan rancangan pada `README.md` — bagian yang paling mudah dirusak
   tanpa sengaja
5. Arah pengembangan dan prioritas pada roadmap
6. Tata cara peninjauan dan penerimaan hasil pekerjaan

---

## 6. Hal yang masih terbuka

Perlu ditetapkan pemberi kerja, bukan diputuskan pihak ketiga:

- [ ] Penerapan Single Sign On — belum ada, memerlukan dukungan pengelola
      identitas kementerian
- [ ] Penanggung jawab kurasi peraturan
- [ ] Kebijakan penyediaan teks peraturan, termasuk lisensi dokumen SNI
- [ ] Kebijakan masa simpan riwayat percakapan dan log audit
- [ ] Kebijakan pencadangan dan pemulihan data

---

## 7. Catatan

Satu hal yang perlu disampaikan terbuka kepada pihak ketiga: skema basis data
semula tidak tersimpan di repositori karena dibuat langsung pada Supabase saat
migrasi. Skema itu sudah dikembalikan ke repositori sebagai `db/schema.sql` dan
dapat diperbarui dengan `node scripts/dump-schema.mjs`.

Setiap perubahan struktur tabel ke depan wajib diikuti pembaruan berkas
tersebut, agar basis data selalu dapat dibangun ulang dari repositori.

# Roadmap: Dari "Tanya PDF" Menjadi Knowledge System Bidang PU

Dokumen ini merancang pengembangan sistem dari kondisi sekarang (RAG atas
naskah jurnal yang diupload/di-harvest) menjadi asisten pengetahuan yang juga
menguasai **base knowledge normatif** (peraturan, NSPK, SNI, pedoman teknis)
dalam lingkup Focus & Scope Jurnal Permukiman:

1. Architecture, Urban and Environment
2. Building Materials, Structure and Construction
3. Building Science and Utilities
4. Drinking Water and Environmental Sanitation

---

## Tujuan akhir (ditetapkan, jadi acuan seluruh prioritas)

**Pengguna utama: peneliti dan penulis naskah.**

Sistem ini pada akhirnya adalah alat bantu peneliti bidang ke-PU-an untuk:

1. menemukan apa yang **sudah** ditemukan riset terdahulu, beserta sitasinya;
2. **membandingkan** temuan antar naskah — metode, lokasi, angka, arah pengaruh;
3. melihat **gap** riset yang masih terbuka, dengan batas cakupan yang jujur;
4. mengetahui **regulasi/SNI apa** yang perlu dirujuk untuk topik yang ditulis.

Peran lain (asisten pengelola jurnal, knowledge base unit kerja) tetap masuk
peta jalan, tetapi berada **di belakang** peran peneliti bila terjadi rebutan
prioritas.

**Cakupan pengetahuan: keempat lapis, dikerjakan berurutan.**

| # | Lapis korpus | Status |
| --- | --- | --- |
| 1 | Naskah Jurnal Permukiman (210 naskah + sinkronisasi OJS) | sudah ada |
| 2 | Teks peraturan & NSPK bidang PU (Permen/PP/SNI/pedoman) | Fase 2 |
| 3 | Literatur luar — metadata & abstrak Garuda/SINTA/Crossref | Fase 5b |
| 4 | Dokumen internal unit kerja | paling akhir, perlu aturan akses |

### Konsekuensi terpenting dari penetapan ini

Karena kemampuan andalannya adalah **analisis gap untuk peneliti**, maka
keterbatasan korpus satu jurnal berubah sifat: dari catatan kaki menjadi
**kendala utama**. Peneliti yang sedang menulis tidak bisa mengklaim adanya
gap hanya berdasarkan 210 artikel dari satu jurnal. Karena itu perluasan ke
lapis 3 (Garuda/SINTA/Crossref) **bukan lagi opsional** — ia syarat agar
keluaran gap layak dipakai di naskah ilmiah.

Konsekuensi kedua: teks peraturan asli (lapis 2) tetap dibutuhkan, tetapi
untuk peneliti kebutuhan mendesaknya adalah *"regulasi apa yang harus saya
rujuk"* — dan itu sudah terjawab oleh indeks rujukan Fase 1c tanpa mengunggah
satu PDF peraturan pun. Jadi lapis 2 turun urutannya, bukan hilang.

---

## 0. Kondisi sekarang (baseline)

| Komponen | Status |
| --- | --- |
| Ingest | Upload PDF/DOCX manual + harvest OJS (`lib/harvest.ts`, `lib/ojs.ts`) |
| Ekstraksi | `pdf-parse` lokal, fallback Gemini (`lib/pdf.ts`, `lib/gemini.ts`) |
| Chunking | Fixed 1000 char + overlap 150 (`lib/chunk.ts`) |
| Embedding | `Xenova/all-MiniLM-L6-v2`, 384 dim, lokal (`lib/embedding.ts`) |
| Retrieval | Hybrid cosine + FTS5, merge sederhana (`lib/rag.ts`) |
| Jawaban | Gemini, 2 mode: `chat` & `kajian` (`lib/chat.ts`) |
| Kekuatan bukti | Jumlah dokumen pendukung, weakest-link (`lib/evidence.ts`) |
| Skills | Instruksi analisis yang bisa diaktifkan admin (`lib/skills.ts`) |
| Auth/audit | Login, role admin/unit_user, audit log (`lib/auth.ts`) |

**Keterbatasan yang menghalangi target baru:**

- Semua dokumen diperlakukan sebagai satu jenis (naskah jurnal). Tidak ada
  konsep "dokumen normatif" dengan nomor, instansi penerbit, dan **status
  berlaku/dicabut**.
- Chunking buta struktur — Pasal/Ayat/klausul SNI terpotong di tengah,
  sehingga sitasi tidak bisa presisi sampai level pasal.
- `fetchAllEmbeddingRows()` memuat **seluruh** vektor ke memori pada setiap
  query. Ini masih jalan untuk ribuan chunk jurnal, tapi akan tumbang saat
  korpus regulasi (ratusan ribu chunk) masuk.
- Model embedding MiniLM-L6 dilatih untuk bahasa Inggris; teks peraturan
  berbahasa Indonesia terwakili buruk.
- Prompt memperlakukan semua konteks setara — tidak membedakan "ini yang
  diwajibkan aturan" vs "ini yang ditemukan riset".

---

## Arsitektur target: dua lapis pengetahuan

```
                    ┌──────────────────────────┐
Pertanyaan  ──►     │  Query Router & Expander │  (normatif / empiris / campuran)
                    └────────────┬─────────────┘
                     ┌───────────┴────────────┐
                     ▼                        ▼
        ┌──────────────────────┐   ┌──────────────────────┐
        │ LAPIS NORMATIF       │   │ LAPIS EMPIRIS        │
        │ UU/PP/Permen/SE/     │   │ Artikel Jurnal       │
        │ SNI/Pedoman NSPK     │   │ Permukiman + riset   │
        │ → "apa yang berlaku" │   │ → "apa yang terbukti"│
        └──────────┬───────────┘   └──────────┬───────────┘
                   └────────────┬─────────────┘
                                ▼
                   Fusion (RRF) → Rerank → Sintesis
                                ▼
              Jawaban: dasar hukum (pasal) + bukti riset (sitasi)
```

Prinsip: **klaim empiris hanya boleh berasal dari naskah riset; klaim normatif
harus selalu bisa ditelusuri ke sumbernya.**

### Keputusan desain: rujukan tangan kedua sah dipakai

Sistem **boleh** menjawab pertanyaan normatif berdasarkan peraturan yang
dikutip di dalam naskah jurnal — kutipan itu punya jejak sumber yang sah dan
tidak perlu ditolak hanya karena teks aslinya belum masuk korpus. Syaratnya
satu: **asal-usulnya wajib dilabeli**, tidak boleh disamarkan seolah sistem
membaca peraturannya langsung.

Setiap sitasi karena itu membawa penanda `provenance`:

| provenance | arti | cara menyebut di jawaban |
| --- | --- | --- |
| `langsung` | teks peraturannya sendiri ada di korpus | "PP 122/2015 Pasal 6 ayat (1)" |
| `kutipan` | peraturan disebut di dalam naskah jurnal | "PP 122/2015 menetapkan 7,5–15 l/org/hari, sebagaimana dikutip dalam naskah *IPA Mobile…*" |

Aturan yang tetap mutlak: **tidak ada satu pun kalimat jawaban tanpa sumber.**
Kalau tidak ada chunk pendukung, sistem menjawab "tidak ditemukan" — bukan
melengkapinya dari pengetahuan umum model.

---

## Arsitektur agent: apa yang perlu jadi agent, apa yang tidak

Prinsip penyaringnya: **setiap agent LLM tambahan berarti satu panggilan model
lagi per pertanyaan** — tambah biaya, tambah latensi, dan yang terpenting
tambah permukaan halusinasi. Komponen yang hasilnya harus bisa direproduksi
justru lebih aman ditulis sebagai fungsi biasa.

### Bukan agent — deterministik, biarkan sebagai fungsi

| Komponen | Status | Alasan |
| --- | --- | --- |
| Retriever (`searchSimilarChunks`) | ada | Cosine + BM25, hasil wajib reproducible |
| Pemanen rujukan peraturan (Fase 1c) | belum | Regex atas nomor SNI/Permen — LLM justru salah ketik nomor |
| Reranker (Fase 3) | belum | Cross-encoder ONNX, bukan penalaran percakapan |
| Sinkronisasi OJS (`lib/harvest.ts`) | ada | Cron job |
| Pencari reviewer (Fase 5) | belum | Cukup kemiripan vektor antar naskah |

### Agent yang layak ada

**1. Penjaga Sitasi (Verifier) — prioritas tertinggi, belum ada**

Berjalan setelah jawaban disusun, sebelum dikirim ke pengguna. Menerjemahkan
syarat "jangan halusinasi, setiap jawaban harus ada sumbernya" menjadi
komponen yang bisa diuji.

- Lapis deterministik (Fase 1b): buang nomor sumber di luar rentang `chunks`;
  tolak jawaban substantif yang `sources`-nya kosong.
- Lapis LLM: cek *entailment* — apakah kalimat jawaban benar-benar tersirat
  di chunk yang dikutip, atau model menambah bumbu di luar konteks.
- Output: lolos / kalimat bermasalah ditandai / jawaban ditolak.
- Mode `kajian` sudah punya versi mentahnya (`validPoints` di
  `app/api/chat/route.ts`); ini memperluasnya ke mode `chat` dan menaikkan
  levelnya dari "ada nomor sumber" menjadi "isinya memang cocok".
- Hemat biaya: cukup dijalankan untuk jawaban substantif — jawaban berupa
  penolakan tidak perlu diverifikasi.

**2. Router Pertanyaan — murah, dampaknya besar**

Satu langkah ringan di depan: pertanyaan ini normatif, empiris, campuran, atau
di luar scope? Hasilnya menentukan alokasi slot konteks antara lapis normatif
dan lapis empiris. Mulai berbasis aturan (deteksi kata "peraturan", "SNI",
"Permen", "wajib", "persyaratan"), naikkan ke LLM hanya bila perlu.

**3. Penelaah Naskah — satu-satunya agent multi-langkah sejati**

Perlu memanggil retrieval berkali-kali dengan pertanyaan berbeda:

1. Naskah ini masuk area Focus & Scope yang mana, seberapa yakin?
2. Peraturan/SNI apa yang seharusnya dirujuk untuk topik ini? (pakai indeks
   Fase 1c)
3. Apakah naskah merujuk edisi lama suatu standar, padahal korpus sudah punya
   edisi lebih baru?
4. Seberapa baru temuannya dibanding naskah yang sudah terbit?

Output berupa **draf** catatan desk review untuk editor, bukan keputusan.
Bergantung pada Fase 1c — tanpa indeks rujukan, agent ini tidak punya bahan.

**4. Analis Gap — multi-langkah, bergantung pada tabel `claims` (Fase 5b)**

Mengumpulkan klaim pada satu topik, menyusun matriks perbandingan, mencari
kontradiksi antar temuan, mencocokkannya dengan gap yang dinyatakan penulis,
lalu memeriksa sel kosong di peta cakupan. Output berupa draf paragraf gap
analysis bersitasi. Agent inilah yang paling terikat pada aturan kejujuran
cakupan: dilarang menyatakan sesuatu "belum pernah diteliti", hanya boleh
"tidak ditemukan dalam korpus ini".

**5. Klasifikator Scope — sekali per dokumen, offline**

Memetakan tiap dokumen ke 4 area Focus & Scope, hasil disimpan di kolom.
Biayanya sekali untuk seluruh korpus, bukan per pertanyaan. Ini yang membuat
filter tema berguna.

### Jangan diotomatiskan

**Kurator status regulasi.** Menetapkan sebuah peraturan "sudah dicabut" punya
konsekuensi berat bila salah. Sistem boleh *mengusulkan* ("naskah A memakai
edisi 2020, naskah B memakai edisi 2000 — kemungkinan ada edisi lebih baru"),
tetapi penetapannya tetap oleh admin dan tercatat di `audit_log`.

### Dampak ke biaya

Mode chat sekarang: 1 panggilan Gemini per pertanyaan. Dengan Router +
Penjaga Sitasi menjadi 3 — masih wajar pada model flash-lite, terutama karena
verifier dilewati untuk jawaban penolakan.

---

## Fase 1 — Pondasi korpus multi-jenis

**Tujuan:** sistem tahu jenis dan status setiap dokumen.

- Tambah kolom `doc_type` di `documents`: `jurnal | regulasi | sni |
  pedoman_teknis | data_statistik`. Pakai pola `ensureColumn()` yang sudah ada
  di `lib/db.ts` agar migrasi tetap aman.
- Tabel baru `regulations` (1-1 dengan `documents` untuk doc_type normatif):

  | kolom | isi |
  | --- | --- |
  | `jenis` | UU / PP / Perpres / Permen PUPR / SE Dirjen / SNI / Pedoman |
  | `nomor`, `tahun` | mis. `14`, `2020` |
  | `instansi` | Kementerian PU, BSN, Pemda, ... |
  | `judul_resmi` | judul lengkap |
  | `tanggal_berlaku` | tanggal mulai berlaku |
  | `status` | `berlaku` / `diubah` / `dicabut` / `draft` |
  | `mengubah_id`, `dicabut_oleh_id` | relasi antar-regulasi |
  | `hierarki_rank` | angka untuk urutan kekuatan hukum |

- Taksonomi `scope_areas`: 4 area Focus & Scope + subtopik (mis. SPAM, IPAL,
  sanitasi, material lokal, struktur tahan gempa, kenyamanan termal, RTH).
  Setiap dokumen — jurnal maupun regulasi — dipetakan ke area ini, sehingga
  bisa dipakai sebagai filter yang sama di kedua lapis.
- Perluas `SearchFilters` di `lib/rag.ts` dengan `docType` dan `scopeArea`.

**Selesai bila:** admin bisa mengunggah Permen PUPR, memberinya metadata
lengkap, dan sistem menandai regulasi yang sudah dicabut.

---

## Fase 1b — Jaminan "tidak ada jawaban tanpa sumber" (kode, bukan prompt)

**Tujuan:** menjadikan syarat wajib itu garansi teknis, bukan sekadar imbauan
di dalam prompt.

Kondisi sekarang berbeda antara dua mode:

- **Mode `kajian` — sudah dijamin.** `app/api/chat/route.ts` membuang poin yang
  `sourceNumbers`-nya kosong (`validPoints`), jadi klaim tanpa sitasi tidak
  pernah sampai ke pengguna.
- **Mode `chat` — belum dijamin.** Bila model mengembalikan
  `used_source_numbers: []`, jawabannya tetap dikirim dan disimpan dengan
  `sources: []`. Yang menahannya saat ini hanya prompt.

Dari 28 percakapan di riwayat, 8 jawaban tersimpan tanpa sumber — semuanya
kebetulan berupa penolakan jujur ("tidak ditemukan di dokumen"). Jadi
promptnya bekerja, tapi belum ada pagar kodenya.

**Yang perlu ditambahkan:**
- Bila `usedSourceNumbers` kosong padahal jawaban bersifat substantif, jangan
  kirim jawaban model — ganti dengan pesan baku "tidak ditemukan di dokumen
  yang tersedia".
- Verifikasi nomor sumber: buang nomor di luar rentang `chunks` (halusinasi
  indeks sitasi).
- Tandai di UI bila jawaban berstatus "tanpa sumber", agar pengguna tidak
  pernah membaca teks yang tak bisa ditelusuri.

---

## Fase 1c — Indeks rujukan peraturan hasil panen dari naskah

**Tujuan:** membangun daftar peraturan bidang PU **dari korpus yang sudah ada**,
tanpa mengunggah satu PDF peraturan pun.

Pemindaian awal atas 8.589 chunk yang ada sekarang menemukan **582 penyebutan
peraturan/SNI dengan 263 nomor unik**, antara lain:

```
 49x  SNI 03-2396-2001      (pencahayaan alami siang hari)
 12x  SNI 03-1726-2002      (ketahanan gempa)
 10x  PP No. 22 Tahun 2021
  9x  SNI 03-1733-2004      (perencanaan lingkungan perumahan)
  8x  SNI 6389:2020  vs  7x SNI 03-6389-2000   ← dua edisi standar yang sama
```

**Rancangan:**
- Tabel `regulation_mentions`: `chunk_id`, `document_id`, `jenis`, `nomor`,
  `tahun`, `teks_asli`, `konteks_kalimat`.
- Panen dengan regex saat chunk dibuat (`SNI …`, `Permen PU(PR) No. x/PRT/M/y`,
  `PP No. x Tahun y`, `UU No. x Tahun y`, `SE Dirjen …`), lalu normalisasi
  nomor agar `SNI 03-6389-2000` dan `SNI 6389:2020` dikenali sebagai dua edisi
  standar yang sama.
- Manfaat langsung, bisa dipakai sebelum Fase 2 selesai:
  - menjawab "peraturan apa saja yang relevan untuk topik X" berbasis korpus;
  - halaman "Peraturan yang dirujuk" per naskah maupun agregat;
  - memberi tahu penulis bahwa naskahnya merujuk **edisi lama** suatu standar
    padahal naskah lain di korpus sudah memakai edisi yang lebih baru — deteksi
    yang murni berbasis data korpus, tanpa perlu database status resmi;
  - daftar prioritas: 263 nomor ini adalah antrean peraturan mana yang paling
    layak diunggah teks aslinya lebih dulu (Fase 2).

---

## Fase 2 — Ingestion & chunking sadar struktur

**Tujuan:** sitasi presisi sampai level pasal/klausul.

- Chunker baru `chunkStructured()` di `lib/chunk.ts` yang mengenali penanda:
  `BAB [angka romawi]`, `Pasal N`, `(1) (2) (3)` untuk ayat, penomoran klausul
  SNI (`6.2.1`), serta `Lampiran` dan judul tabel. Satu pasal pendek = satu
  chunk utuh; pasal panjang dipecah tapi tetap membawa header induknya.
- Tambah kolom di `chunks`: `heading_path` (mis. `BAB IV > Pasal 12 > ayat
  (2)`), `page_from`, `page_to`. Sitasi berubah dari `nama-file.pdf bagian 7`
  menjadi **"Permen PUPR No. 14/2020, Pasal 12 ayat (2)"** — ini pembeda utama
  antara sistem yang dipercaya dan tidak.
- OCR fallback: banyak peraturan lama beredar sebagai PDF hasil pindai.
  `lib/pdf.ts` sekarang hanya `pdf-parse`; tambahkan deteksi "teks kosong atau
  terlalu sedikit per halaman" lalu alihkan ke jalur ekstraksi Gemini vision
  yang sudah ada.
- Sumber ingest: upload manual (utama), plus konektor semi-otomatis ke JDIH
  Kementerian PU / peraturan.go.id — tetap wajib melewati kurasi admin sebelum
  masuk indeks.

> **Catatan lisensi:** dokumen SNI berbayar dan tidak boleh didistribusikan
> ulang. Batasi penyimpanan penuh SNI ke instansi yang memang punya lisensi,
> dan pertimbangkan menyimpan hanya metadata + ringkasan klausul untuk SNI
> yang tidak dilisensi.

---

## Fase 3 — Retrieval naik kelas

**Tujuan:** akurat dan tetap cepat saat korpus membesar 50-100x.

1. **Ganti model embedding** ke multilingual (`Xenova/multilingual-e5-small`
   atau `paraphrase-multilingual-MiniLM-L12-v2`) — keduanya tersedia dalam
   format ONNX sehingga tetap berjalan lokal. Kolom `model` di tabel
   `embeddings` sudah ada, jadi migrasi bisa bertahap: embed ganda,
   bandingkan hasilnya di gold set, baru cutover.
2. **Indeks vektor sungguhan.** Ganti full-scan `fetchAllEmbeddingRows()`
   dengan ekstensi `sqlite-vec` (virtual table `vec0`). Ini blokir teknis yang
   harus beres sebelum korpus regulasi masuk.
3. **Fusion yang benar.** Merge sekarang mempertahankan urutan cosine saja.
   Ganti dengan Reciprocal Rank Fusion agar peringkat BM25 dan peringkat
   semantik digabung secara adil.
4. **Reranker.** Cross-encoder kecil (ONNX) untuk memeringkat ulang top-50
   menjadi top-8 sebelum masuk prompt. Ini kenaikan presisi terbesar per
   satuan usaha.
5. **Query routing & expansion.** Klasifikasi pertanyaan (normatif / empiris /
   campuran) menentukan alokasi slot konteks. Tambah kamus sinonim domain PU
   (SPAM, IPAL, TPS3R, RISHA, hunian vertikal, rumah tapak, kawasan kumuh)
   untuk memperkaya query FTS.

---

## Fase 4 — Lapisan penalaran & jawaban

- **Prompt dua blok.** `lib/chat.ts` menyusun konteks menjadi
  `LANDASAN NORMATIF` dan `BUKTI EMPIRIS` terpisah, dengan aturan eksplisit:
  klaim "wajib/harus/disyaratkan" hanya boleh berasal dari blok normatif.
- **Guard status regulasi.** Bila chunk terpilih berasal dari regulasi
  berstatus `dicabut`/`diubah`, jawaban wajib menandainya dan menyebut
  penggantinya. Ini penjaga risiko terbesar sistem ini.
- **Mode baru** di samping `chat` dan `kajian`:
  - `cek_regulasi` — "apa aturannya soal X?" → jawaban berbasis pasal +
    status berlaku.
  - `telaah_naskah` — penulis menempel abstrak/naskah, sistem mengaitkannya ke
    regulasi relevan dan bukti riset terdahulu.
- **Perluas `lib/evidence.ts`.** Kekuatan bukti kini hanya menghitung jumlah
  dokumen pendukung. Tambahkan dimensi: hierarki hukum (UU > PP > Permen > SE >
  pedoman) untuk klaim normatif, dan kemutakhiran (tahun terbit) untuk klaim
  empiris.

---

## Fase 5 — Fitur langsung untuk penulis & pengelola jurnal

Semua output di fase ini adalah **draf untuk ditinjau manusia**, bukan
keputusan otomatis.

**Untuk penulis:**
- Cek kesesuaian Focus & Scope: klasifikasi naskah ke 4 area + tingkat
  keyakinan + alasan.
- Saran regulasi/SNI relevan yang sebaiknya dirujuk untuk topik naskah.
- Pemeriksa rujukan kadaluarsa: mendeteksi naskah yang masih mengutip
  peraturan atau SNI yang sudah dicabut.
- Cek kelengkapan struktur IMRAD dan gaya sitasi.

**Untuk editor/reviewer:**
- Desk review otomatis: ringkasan naskah, kebaruan dibanding korpus terbit,
  tumpang tindih tekstual dengan artikel yang sudah ada.
- Saran calon reviewer berdasarkan kedekatan topik dengan artikel terdahulu.

---

## Fase 5b — Analisis perbandingan & gap riset

**Tujuan:** membantu peneliti melihat apa yang sudah ditemukan, di mana
temuan-temuan itu saling bertentangan, dan di mana lubangnya.

### Kenapa ini tidak bisa dikerjakan retrieval biasa

Pencarian kemiripan pandai menemukan yang **ada**, dan buta terhadap yang
**tidak ada**. Gap justru soal ketiadaan — chunk yang tidak pernah ditulis
tidak akan pernah muncul di hasil pencarian, seberapa pun bagus embedding-nya.
Karena itu gap tidak bisa "dicari", tetapi harus **dihitung dari data
terstruktur**. Ini membuat Fase 5b bergantung mutlak pada satu lapisan baru di
bawah.

### Lapisan data: tabel `claims`

Sekali per dokumen, offline. Mengubah teks bebas menjadi baris yang bisa
dibandingkan:

| kolom | isi |
| --- | --- |
| `document_id` | naskah asal |
| `topik`, `variabel` | apa yang diteliti |
| `metode` | eksperimen lab / survei / simulasi / studi kasus |
| `lokasi` | wilayah studi (banyak naskah PU bersifat kasus lokal) |
| `temuan` | pernyataan temuan |
| `nilai`, `satuan` | angka bila ada — inilah yang membuat dua temuan bisa diadu |
| `arah` | naik / turun / tidak berpengaruh |
| `keterbatasan` | keterbatasan yang diakui penulis |
| `saran_lanjutan` | riset lanjutan yang disarankan penulis |
| `chunk_id` | **wajib** — setiap klaim tetap menunjuk sumbernya |

Modal yang sudah tersedia di korpus sekarang: **209 dari 210 dokumen punya
tahun terbit (rentang 2008–2025)**, 204 abstrak, 203 daftar topik, 202 DOI.

### Kemampuan yang lahir dari lapisan itu

**1. Matriks perbandingan (tabel state of the art)**

Untuk satu topik, hasilkan tabel: naskah × (tahun, metode, lokasi, temuan,
nilai). Ini persis tabel perbandingan yang ditulis peneliti di bab tinjauan
pustaka. Setelah `claims` ada, penyusunannya deterministik — tidak perlu LLM.

**2. Deteksi kontradiksi antar temuan**

Cari pasangan klaim pada variabel yang sama dengan `arah` berlawanan, atau
`nilai` yang selisihnya jauh. Saring dulu kandidatnya dengan kemiripan
embedding agar jumlah pasangan yang perlu dicek LLM tetap masuk akal, baru
konfirmasi kontradiksinya. Output: "naskah A (2012, lab) dan naskah B (2019,
lapangan) melaporkan arah berbeda untuk variabel yang sama".

**3. Gap yang dinyatakan penulis — panen langsung, sudah tersedia**

Pemindaian korpus sekarang menemukan pernyataan gap eksplisit di **±50
dokumen**:

```
"saran penelitian selanjutnya"    17 chunk / 13 dokumen
"keterbatasan penelitian"         28 chunk / 18 dokumen
"perlu dikaji lebih lanjut"       37 chunk / 29 dokumen
```

Ini gap yang ditulis peneliti sendiri, jadi kekuatan sumbernya paling tinggi
dan langsung bisa disitasi. Regex hanya untuk **menyaring kandidat**, bukan
memutuskan — contoh tangkapan palsu yang muncul: *"masih terbatas pada
pembangunan sarana mandi, cuci, kakus"* (itu keterbatasan program, bukan gap
riset). Penyaring akhirnya tetap LLM dengan sitasi wajib.

**4. Peta cakupan — gap karena ketiadaan**

Bangun matriks: area Focus & Scope × metode × wilayah × periode tahun. Sel
yang kosong atau sangat tipis adalah **kandidat** gap. Contoh bentuk temuan:
"topik sanitasi banyak diteliti dengan studi kasus perkotaan Jawa, hampir
tidak ada dengan pendekatan eksperimental di luar Jawa".

**5. Tren temporal**

Dengan rentang 2008–2025, pergeseran fokus riset per periode bisa dipetakan:
topik yang meredup, topik yang menguat, topik yang berhenti diteliti setelah
tahun tertentu.

### Agent Analis Gap

Multi-langkah, memanggil lapisan di atas secara berurutan: kumpulkan klaim
pada topik → susun matriks perbandingan → cek kontradiksi → cocokkan dengan
gap yang dinyatakan penulis → periksa sel kosong di peta cakupan. Output
berupa **draf paragraf gap analysis lengkap dengan sitasi**, untuk ditinjau
dan ditulis ulang peneliti.

### Batas kejujuran yang wajib dipegang

Ini aturan terpenting di seluruh fase ini, dan langsung menurun dari syarat
"jangan berhalusinasi":

> Sel kosong di peta cakupan berarti **"tidak ditemukan dalam korpus ini"**,
> bukan **"belum pernah diteliti"**. Sistem tidak boleh sekali pun menyatakan
> sesuatu belum pernah diteliti.

Korpus sekarang adalah 210 naskah dari satu jurnal. Klaim gap yang jujur
karena itu berbunyi: *"dalam 210 naskah Jurnal Permukiman 2008–2025, tidak
ditemukan studi yang…"* — lengkap dengan menyebut batas korpusnya. Setiap
output gap wajib membawa keterangan cakupan ini.

### Perluasan cakupan ke lapis 3 — syarat, bukan pelengkap

Karena tujuan akhir sistem ini adalah melayani peneliti, keluaran gap-nya akan
dipakai di dalam naskah ilmiah. Gap yang hanya berdasar 210 artikel dari satu
jurnal tidak cukup kuat untuk itu. Karena itu korpus pembanding **harus**
diperluas dengan **metadata dan abstrak saja** (bukan teks penuh) dari
Garuda/SINTA atau Crossref untuk topik-topik dalam scope jurnal.

Efeknya menaikkan pernyataan dari *"gap dalam jurnal ini"* menjadi *"gap dalam
literatur berbahasa Indonesia yang terindeks"*, dengan biaya penyimpanan jauh
lebih ringan daripada teks penuh. Batas cakupan tetap wajib disebut, hanya
batasnya bergeser jadi lebih luas dan lebih layak disitasi.

---

## Fase 6 — Kualitas, evaluasi, dan tata kelola

- **Gold set evaluasi:** 50-100 pertanyaan PU (merata di 4 area) dengan
  jawaban dan sitasi yang sudah diverifikasi. Ukur `recall@k`, ketepatan
  sitasi, dan groundedness. Infrastruktur Vitest sudah ada (`tests/rag`) —
  jadikan regresi ini bagian dari CI.
- **Umpan balik pengguna:** tombol akurat/tidak pada tiap jawaban, disimpan
  bersama `chat_history` untuk analisis kegagalan retrieval.
- **Observability:** catat chunk yang terambil, latensi, dan biaya per query.
- **Tata kelola konten:** hanya admin/kurator yang boleh menetapkan status
  regulasi; setiap perubahan tercatat di `audit_log` yang sudah ada.
- **Disclaimer:** sistem membantu menemukan dan merangkum dasar aturan, bukan
  memberi nasihat hukum atau persetujuan teknis.

---

## Urutan pengerjaan yang disarankan

Disusun ulang setelah tujuan akhir ditetapkan: **peneliti/penulis lebih dulu.**

| Prioritas | Pekerjaan | Alasan |
| --- | --- | --- |
| ~~P0~~ **selesai** | Fase 1b (jaminan sumber di kode) + Penjaga Sitasi lapis deterministik | `lib/citation.ts`, pagar di `app/api/chat/route.ts` untuk mode chat & kajian |
| ~~P0~~ **selesai** | Fase 1c (panen rujukan peraturan dari naskah) | `lib/regulations.ts` + `app/api/regulations` + tab UI; 786 rujukan, 225 nomor, 37 deteksi edisi lama |
| ~~P1~~ **sebagian** | Router Pertanyaan — versi berbasis aturan | `lib/query.ts` (`isNormativeQuestion`, kamus sinonim PU) + jalur pencarian peraturan di `lib/rag.ts`. Sisa: versi LLM bila akurasinya kurang |
| ~~P1~~ **selesai** | Panen pernyataan gap penulis (Fase 5b butir 3) | `lib/claims.ts` + `app/api/claims` + tab UI; 111 pernyataan dari 59 naskah, di atas tabel `claims` yang tinggal diisi kolom temuannya |
| P1 | Tabel `claims` — ekstraksi klaim seluruh korpus | Fondasi seluruh kemampuan perbandingan & gap |
| P1 | Klasifikator Scope (sekali jalan, 210 dokumen) | Pengelompokan topik yang dipakai matriks perbandingan |
| P1 | Penjaga Sitasi lapis LLM (cek entailment tiap klaim) | Menaikkan jaminan dari "ada nomor sumber" menjadi "isinya memang cocok" |
| P2 | Fase 5b lengkap (matriks, kontradiksi, peta cakupan) + agent Analis Gap | Kemampuan andalan; berdiri di atas tabel `claims` |
| P2 | Perluasan korpus lapis 3 (Garuda/SINTA/Crossref) | **Syarat** agar klaim gap layak dipakai di naskah ilmiah |
| P2 | Fase 3 butir 2 (indeks vektor) | Blokir teknis yang menagih tepat saat lapis 3 masuk |
| P2 | Fase 1 (doc_type + label `provenance`) | Membedakan sitasi langsung vs kutipan |
| P2 | Fase 6 (gold set) | Mulai bersamaan P1 agar setiap perbaikan terukur |
| P3 | Fase 3 butir 1, 3, 4, 5 (model, RRF, rerank, ekspansi query) | Peningkatan kualitas bertahap |
| P3 | Fase 2 (unggah teks peraturan + chunking pasal) | Menaikkan sitasi dari `kutipan` ke `langsung`; kebutuhan mendesaknya sudah ditambal Fase 1c |
| P3 | Fase 4 (prompt dua blok + guard status regulasi) | Deteksi edisi lama sementara sudah ditangani Fase 1c |
| P4 | Fase 5 + agent Penelaah Naskah (peran pengelola jurnal) | Peran sekunder menurut tujuan akhir |
| P4 | Lapis 4 — dokumen internal unit kerja | Perlu aturan akses & kerahasiaan lebih dulu |

## Risiko utama

1. **Jawaban tanpa sumber** — mitigasi: pagar kode di Fase 1b, bukan hanya
   instruksi di prompt.
2. **Halusinasi nomor pasal** — mitigasi: chunking sadar struktur + verifikasi
   nomor pasal yang dikutip terhadap `heading_path` sebelum jawaban dikirim.
3. **Kutipan tangan kedua tampak seperti sitasi langsung** — mitigasi: label
   `provenance` wajib ikut sampai ke teks jawaban, bukan hanya tersimpan di
   database.
4. **Mengutip aturan edisi lama/sudah dicabut** — mitigasi: deteksi antar-edisi
   dari korpus (Fase 1c), lalu guard status penuh di Fase 4.
5. **Lisensi SNI** — mitigasi: kontrol akses per instansi, simpan metadata
   saja bila tidak dilisensi.
6. **Korpus regulasi tidak terawat** — mitigasi: penanggung jawab kurasi yang
   jelas + peninjauan berkala status regulasi.
7. **Klaim gap yang overclaim** — menyatakan "belum pernah diteliti" padahal
   yang benar hanya "tidak ada di 210 naskah jurnal ini". Mitigasi: setiap
   output gap wajib mencantumkan batas cakupan korpusnya (Fase 5b).

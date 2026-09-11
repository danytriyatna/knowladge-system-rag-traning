import { describe, expect, it } from "vitest";
import {
  extractRegulationMentions,
  extractRegulationTitle,
  extractCitedArticles,
  isAllowedRegulationUrl,
} from "@/lib/regulations";

/**
 * Nomor peraturan adalah data yang harus persis — satu digit bergeser berarti
 * menunjuk aturan yang sama sekali lain. Tes ini mengunci perilaku pemanen
 * regex-nya, termasuk apa saja yang WAJIB TIDAK ditangkap.
 */
describe("extractRegulationMentions", () => {
  it("menangkap SNI format lama (dengan awalan ICS) dan format baru", () => {
    const hasil = extractRegulationMentions(
      "Perhitungan mengacu pada SNI 03-1726-2002 dan diperbarui oleh SNI 1726:2019."
    );

    expect(hasil).toHaveLength(2);
    expect(hasil.map((h) => h.nomor_lengkap)).toEqual([
      "SNI 03-1726-2002",
      "SNI 1726:2019",
    ]);
    // Inti deteksi lintas-edisi: dua edisi standar yang sama harus punya
    // nomor_normal identik supaya bisa dibandingkan.
    expect(new Set(hasil.map((h) => h.nomor_normal)).size).toBe(1);
    expect(hasil[0].nomor_normal).toBe("SNI-1726");
    expect(hasil.map((h) => h.tahun)).toEqual([2002, 2019]);
  });

  it("menangkap Permen format PRT/M, PP, dan UU", () => {
    const hasil = extractRegulationMentions(
      "Mengacu pada Permen PU No. 18/PRT/M/2007, PP No. 122 Tahun 2015, " +
        "serta Undang-Undang Nomor 1 Tahun 2011 tentang perumahan."
    );

    const nomor = hasil.map((h) => h.nomor_lengkap);
    expect(nomor).toContain("Permen PUPR No. 18/PRT/M/2007");
    expect(nomor).toContain("PP No. 122 Tahun 2015");
    expect(nomor).toContain("UU No. 1 Tahun 2011");
  });

  it("mengabaikan penyebutan telanjang tanpa nomor standar", () => {
    // "SNI 2013" muncul puluhan kali di korpus tapi tidak menunjuk standar
    // mana pun — kalau ikut terpanen, indeksnya jadi penuh derau.
    const hasil = extractRegulationMentions(
      "Pengujian dilakukan sesuai SNI dan mengikuti SNI 2013 yang berlaku."
    );
    expect(hasil).toHaveLength(0);
  });

  it("menolak tahun yang tidak masuk akal", () => {
    const hasil = extractRegulationMentions("Disebutkan SNI 1726:1899 di naskah.");
    expect(hasil).toHaveLength(0);
  });

  it("tidak menggandakan penyebutan berulang di satu chunk", () => {
    const hasil = extractRegulationMentions(
      "SNI 03-2396-2001 dipakai di sini. Menurut SNI 03-2396-2001, nilainya berbeda."
    );
    expect(hasil).toHaveLength(1);
    expect(hasil[0].teks_asli).toBe("SNI 03-2396-2001");
  });

  it("menangkap nama peraturan yang dieja penuh dengan singkatan dalam kurung", () => {
    // Bentuk yang sangat lazim di naskah ilmiah Indonesia. Sempat terlewat dan
    // membuat kalimat kunci PP 16/2021 tidak pernah masuk indeks rujukan.
    const hasil = extractRegulationMentions(
      "efisiensi energi diperkuat melalui Peraturan Pemerintah (PP) Nomor 16 Tahun 2021 " +
        "Pasal 222-226, serta Permen Pekerjaan Umum dan Perumahan Rakyat (PUPR) " +
        "Nomor 21 Tahun 2021 Pasal 12 ayat (6), dan Undang-Undang (UU) Nomor 28 Tahun 2002."
    );

    const nomor = hasil.map((h) => h.nomor_lengkap);
    expect(nomor).toContain("PP No. 16 Tahun 2021");
    expect(nomor).toContain("Permen No. 21 Tahun 2021");
    expect(nomor).toContain("UU No. 28 Tahun 2002");
  });

  it("tahan terhadap variasi spasi dan penulisan nomor", () => {
    const hasil = extractRegulationMentions(
      "Peraturan Pemerintah Nomor 22 Tahun 2021 dan Permen PUPR Nomor 27 / PRT / M / 2016."
    );
    const nomor = hasil.map((h) => h.nomor_lengkap);
    expect(nomor).toContain("PP No. 22 Tahun 2021");
    expect(nomor).toContain("Permen PUPR No. 27/PRT/M/2016");
  });
});

/**
 * Judul dan pasal adalah satu-satunya "isi peraturan" yang bisa ditampilkan
 * secara jujur selama teks aslinya belum ada di sistem — keduanya dipungut
 * apa adanya dari kalimat naskah, bukan dari pengetahuan model.
 */
describe("extractRegulationTitle", () => {
  it("memungut judul resmi dari pola '<nomor> tentang <judul>'", () => {
    const judul = extractRegulationTitle(
      "Mengacu pada PP No. 16 Tahun 2021 tentang Peraturan Pelaksanaan Undang-Undang " +
        "Nomor 28 Tahun 2002 tentang Bangunan Gedung. Selanjutnya dibahas.",
      "PP No. 16 Tahun 2021"
    );
    expect(judul).toBe(
      "Peraturan Pelaksanaan Undang-Undang Nomor 28 Tahun 2002 tentang Bangunan Gedung"
    );
  });

  it("berhenti di koma agar anak kalimat tidak ikut terbawa", () => {
    const judul = extractRegulationTitle(
      "Permen No. 21 Tahun 2021 tentang penilaian kinerja bangunan gedung hijau, " +
        "yang mengatur tahapan sertifikasi.",
      "Permen No. 21 Tahun 2021"
    );
    expect(judul).toBe("penilaian kinerja bangunan gedung hijau");
  });

  it("berhenti di penanda anak kalimat walau tanpa koma", () => {
    // Kasus nyata dari korpus: judul disambung langsung ke anak kalimat,
    // sehingga tanpa penanda ini judulnya kebablasan sampai 160 karakter.
    const judul = extractRegulationTitle(
      "PP No. 16 Tahun 2021 tentang Bangunan Gedung yang turut menyertakan proses " +
        "lanjutan Sertifikat Laik Fungsi sebelum akhirnya diterbitkan.",
      "PP No. 16 Tahun 2021"
    );
    expect(judul).toBe("Bangunan Gedung");
  });

  it("membuang penanda kata kerja yang jatuh di ujung potongan", () => {
    // Kasus nyata: potongan berakhir tepat di kata kerjanya, sehingga pemotong
    // yang butuh spasi di kedua sisi tidak kena.
    const judul = extractRegulationTitle(
      "Permen PUPR No. 05/PRT/M/2008 tentang Pedoman Penyediaan dan Pemanfaatan " +
        "RTH di Kawasan Perkotaan menetapkan, luasan minimal 30%.",
      "Permen PUPR No. 05/PRT/M/2008"
    );
    expect(judul).toBe("Pedoman Penyediaan dan Pemanfaatan RTH di Kawasan Perkotaan");
  });

  it("mengembalikan null kalau naskah tidak menyebut judulnya", () => {
    expect(
      extractRegulationTitle("Perhitungan mengacu SNI 6389:2020 dan hasilnya.", "SNI 6389:2020")
    ).toBeNull();
  });
});

describe("extractCitedArticles", () => {
  it("menangkap rentang pasal dan ayat", () => {
    expect(
      extractCitedArticles(
        "diperkuat melalui PP No. 16 Tahun 2021 Pasal 222-226 yang mewajibkan BGH.",
        "PP No. 16 Tahun 2021"
      )
    ).toEqual(["Pasal 222–226"]);

    expect(
      extractCitedArticles(
        "Merujuk Permen No. 21 Tahun 2021, Pasal 12 ayat (6), kegiatan pengubahsuaian.",
        "Permen No. 21 Tahun 2021"
      )
    ).toEqual(["Pasal 12 ayat (6)"]);
  });

  it("tidak menyeret pasal milik peraturan lain yang jauh di belakang", () => {
    const hasil = extractCitedArticles(
      "PP No. 16 Tahun 2021 dibahas lebih dulu. " +
        "Kemudian pembahasan panjang mengenai metodologi penelitian dan analisis data yang " +
        "digunakan pada studi ini. Selanjutnya UU No. 28 Tahun 2002 Pasal 5 mengatur hal lain.",
      "PP No. 16 Tahun 2021"
    );
    expect(hasil).toEqual([]);
  });
});

/**
 * Tautan sumber resmi ditampilkan sebagai rujukan otoritatif kepada peneliti,
 * jadi hanya boleh menunjuk situs JDIH resmi — bukan sembarang URL.
 */
describe("isAllowedRegulationUrl", () => {
  it("menerima URL JDIH resmi lewat https", () => {
    expect(
      isAllowedRegulationUrl(
        "https://peraturan.bpk.go.id/Details/285541/permen-pupr-no-5-tahun-2008"
      )
    ).toBe(true);
    expect(isAllowedRegulationUrl("https://jdih.pu.go.id/detail-dokumen/123")).toBe(true);
  });

  it("menolak host di luar daftar dan protokol non-https", () => {
    expect(isAllowedRegulationUrl("https://contoh-situs-lain.com/peraturan")).toBe(false);
    expect(isAllowedRegulationUrl("http://peraturan.bpk.go.id/Details/285541")).toBe(false);
    expect(isAllowedRegulationUrl("bukan-url")).toBe(false);
  });

  it("menolak host yang cuma menyerupai domain resmi", () => {
    expect(isAllowedRegulationUrl("https://peraturan.bpk.go.id.palsu.com/x")).toBe(false);
  });
});

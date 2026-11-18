export interface CuratedKnowledgeDoc {
  key: string;
  filename: string;
  title: string;
  topics: string[];
  content: string;
}

/**
 * Basis pengetahuan resmi tentang JP-Insight sendiri agar widget dan chat
 * dapat menjawab pertanyaan mengenai tujuan, cara kerja, sumber data,
 * aturan sitasi, privasi, serta perannya dalam ekosistem Jurnal Permukiman.
 */
export const JP_INSIGHT_DOCUMENTS: CuratedKnowledgeDoc[] = [
  {
    key: "jp_insight_overview",
    filename: "jp-insight-profil-dan-panduan.pdf",
    title: "Profil Resmi, Cara Kerja, dan Panduan JP-Insight",
    topics: ["JP-Insight", "Asisten Cerdas", "Ekosistem Jurnal Permukiman", "Cara Kerja", "Sitasi"],
    content: [
      "Profil Resmi dan Panduan JP-Insight — Asisten Cerdas Jurnal Permukiman KemenPU",
      "",
      "## Apa Itu JP-Insight?",
      "JP-Insight adalah sistem pengetahuan (knowledge system), asisten cerdas, dan pendukung keputusan berbasis korpus Jurnal Permukiman yang dikelola di lingkungan Direktorat Bina Teknik Bangunan Gedung dan Penyehatan Lingkungan, Kementerian Pekerjaan Umum (KemenPU). JP-Insight membantu peneliti, penulis naskah, reviewer, pengelola jurnal, dan pembaca menemukan temuan riset terdahulu, menelusuri rujukan peraturan atau SNI, melihat celah riset, serta memperoleh informasi resmi seputar portal Jurnal Permukiman dan sistem JP-Insight sendiri.",
      "",
      "## Peran JP-Insight dalam Ekosistem Jurnal Permukiman (OJS vs MQC vs JP-Insight)",
      "Ekosistem digital Jurnal Permukiman terdiri dari tiga aplikasi yang saling melengkapi:",
      "1. Portal OJS Jurnal Permukiman (e-ISSN 2339-2975): Portal publikasi resmi artikel ilmiah, kebijakan jurnal, panduan penulis, alur pengiriman naskah (submission), serta proses telaah editorial.",
      "2. MQC Assistant (Manuscript Quality Check): Sistem pra-telaah otomatis untuk mengevaluasi kesesuaian gaya selingkung, format naskah Word (.docx), serta melakukan verifikasi daftar pustaka terhadap basis data metadata ilmiah terbuka seperti Crossref, OpenAlex, dan OpenLibrary.",
      "3. JP-Insight: Sistem penelusuran pengetahuan dan asisten tanya-jawab berbasis arsip artikel terbitan OJS Jurnal Permukiman, informasi portal resmi Jurnal Permukiman, dan dokumentasi resmi JP-Insight.",
      "",
      "## Sumber Data dan Cara Kerja JP-Insight",
      "JP-Insight menggabungkan pencarian hibrida (hybrid retrieval) antara kemiripan makna semantik (vector cosine similarity melalui pgvector PostgreSQL dengan model embedding lokal all-MiniLM-L6-v2) dan pencocokan kata kunci (PostgreSQL full-text search).",
      "Pada widget publik JP-Insight yang terpasang di portal OJS dan MQC, sumber jawaban dibatasi hanya pada tiga kelompok dokumen resmi yang telah terindeks:",
      "- Artikel ilmiah yang telah terbit di OJS Jurnal Permukiman (sinkronisasi OAI-PMH).",
      "- Halaman informasi dan kebijakan resmi dari portal web Jurnal Permukiman (seperti panduan penulis, aims and scope, APC, etika publikasi, dewan editor, pengumuman, dan cara pendaftaran).",
      "- Dokumentasi profil dan panduan resmi JP-Insight.",
      "",
      "## Aturan Anti-Halusinasi, Sitasi, dan Keamanan Data",
      "JP-Insight menerapkan aturan pagar sitasi mutlak di tingkat kode: tidak ada jawaban tanpa sumber yang terverifikasi.",
      "- Setiap jawaban hanya disusun dari potongan dokumen yang benar-benar relevan di dalam basis data terindeks, disertai daftar sumber rujukan beserta tautan ke artikel OJS atau halaman resmi terkait.",
      "- Jika pertanyaan berada di luar lingkup korpus Jurnal Permukiman maupun JP-Insight atau tidak ada rujukan yang mendukung, sistem wajib menyatakan bahwa informasi tidak ditemukan dan dilarang keras mengarang jawaban.",
      "- Privasi dan isolasi data: Widget publik JP-Insight tidak pernah mengakses berkas unggahan internal atau dokumen evaluasi non-publik (manual_upload).",
      "",
      "## Fitur Utama JP-Insight dan Widget Asisten",
      "- Widget Chat JP-Insight (ikon kanan bawah portal OJS dan MQC): Mendukung tombol Minimize (melipat menjadi bar mini), Maximize / Restore (perbesar hampir layar penuh agar mudah membaca jawaban panjang dan rujukan), serta mempertahankan riwayat percakapan selama halaman dibuka.",
      "- Aplikasi Internal JP-Insight: Menyediakan mode Chat interaktif, Mode Kajian untuk menyintesis bukti lintas beberapa naskah lengkap dengan indikator kekuatan bukti (kuat, sedang, lemah berdasarkan prinsip weakest-link), indeks rujukan peraturan/SNI, serta pemetaan klaim atau celah riset.",
      "- Korespondensi resmi terkait pengelolaan jurnal atau pendaftaran akun OJS tetap ditangani oleh tim editorial melalui email jurnalpermukiman@pu.go.id.",
    ].join("\n"),
  },
];

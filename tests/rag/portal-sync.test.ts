import { describe, expect, it } from "vitest";
import {
  OJS_PORTAL_PAGES,
  resolvePortalUrls,
  resolveOjsArticleBaseUrl,
  extractOjsMainContent,
  decodeHtmlEntities,
  computeContentHash,
} from "@/lib/portalExtract";
import { JP_INSIGHT_DOCUMENTS } from "@/lib/jpInsightKnowledge";
import { expandQueryTerms, isAssistantIdentityQuestion } from "@/lib/query";

describe("portalExtract & JP-Insight knowledge", () => {
  it("memilih OJS_PUBLIC_URL untuk crawl lokal/VPS sesuai Opsi 3A", () => {
    expect(
      resolvePortalUrls({ OJS_PUBLIC_URL: "http://localhost:8000/index.php/JP/" }),
    ).toEqual({
      crawlBaseUrl: "http://localhost:8000/index.php/JP",
      publicBaseUrl: "http://localhost:8000/index.php/JP",
    });

    expect(
      resolvePortalUrls({
        OJS_PUBLIC_URL: "https://jurnalpermukiman.pu.go.id/index.php/JP",
        OJS_PORTAL_CRAWL_URL: "http://jp-ojs/index.php/JP/",
      }),
    ).toEqual({
      crawlBaseUrl: "http://jp-ojs/index.php/JP",
      publicBaseUrl: "https://jurnalpermukiman.pu.go.id/index.php/JP",
    });

    // Lokal bila hanya OJS_OAI_URL yang diset di .env.local
    expect(
      resolveOjsArticleBaseUrl({ OJS_OAI_URL: "http://localhost:8000/index.php/JP/oai" }),
    ).toBe("http://localhost:8000/index.php/JP/article/view");

    // Produksi Docker memprioritaskan OJS_PUBLIC_URL / OJS_ARTICLE_BASE_URL di atas OJS_OAI_URL internal container
    expect(
      resolveOjsArticleBaseUrl({
        OJS_PUBLIC_URL: "http://103.1.2.3/index.php/JP",
        OJS_OAI_URL: "http://jp-ojs/index.php/JP/oai",
      }),
    ).toBe("http://103.1.2.3/index.php/JP/article/view");

    // Fallback default lokal :8000 (bukan /jurnalpermukiman/)
    expect(resolveOjsArticleBaseUrl({})).toBe("http://localhost:8000/index.php/JP/article/view");
  });

  it("mengekstrak konten utama OJS dan membuang script, breadcrumb, sidebar, dan footer", () => {
    const sampleHtml = `
      <!doctype html>
      <html>
        <head><title>Registration | Jurnal Permukiman</title></head>
        <body>
          <header class="pkp_structure_head">Menu Navigasi Lama</header>
          <div class="pkp_structure_main" role="main">
            <nav class="cmp_breadcrumbs">Home / Register</nav>
            <div class="page page_register">
              <h2>Registration</h2>
              <p>To proceed with registration, contact <a href="mailto:jurnalpermukiman@pu.go.id">jurnalpermukiman@pu.go.id</a>.</p>
              <ul><li>Given Name</li><li>Email Address &amp; Affiliation</li></ul>
            </div>
            <script>console.log("should-be-removed");</script>
          </div><!-- pkp_structure_main -->
          <div class="pkp_structure_sidebar left">Sidebar Noise</div>
          <div class="pkp_structure_footer_wrapper">Footer Noise</div>
        </body>
      </html>
    `;

    const extracted = extractOjsMainContent(sampleHtml);
    expect(extracted.htmlTitle).toBe("Registration | Jurnal Permukiman");
    expect(extracted.text).toContain("Registration");
    expect(extracted.text).toContain("jurnalpermukiman@pu.go.id");
    expect(extracted.text).toContain("- Given Name");
    expect(extracted.text).toContain("- Email Address & Affiliation");
    expect(extracted.text).not.toContain("should-be-removed");
    expect(extracted.text).not.toContain("Menu Navigasi Lama");
    expect(extracted.text).not.toContain("Sidebar Noise");
    expect(extracted.text).not.toContain("Footer Noise");
    expect(extracted.text).not.toContain("Home / Register");
  });

  it("mendekode entitas HTML umum dan menghasilkan hash konten stabil", () => {
    expect(decodeHtmlEntities("A&amp;B &nbsp; &ldquo;C&rdquo; &#8212; &#x2013;")).toBe(
      'A&B   "C" — –',
    );
    expect(computeContentHash(["a", "b"])).toBe(computeContentHash(["a", "b"]));
    expect(computeContentHash(["a", "b"])).not.toBe(computeContentHash(["a", "c"]));
  });

  it("memuat whitelist portal OJS lengkap dan dokumen resmi JP-Insight", () => {
    const slugs = OJS_PORTAL_PAGES.map((p) => p.slug);
    expect(slugs).toContain("about");
    expect(slugs).toContain("about/submissions");
    expect(slugs).toContain("fokus");
    expect(slugs).toContain("ArticleProcessingCharge");
    expect(slugs).toContain("user/register");

    expect(JP_INSIGHT_DOCUMENTS.length).toBeGreaterThanOrEqual(1);
    const overview = JP_INSIGHT_DOCUMENTS[0];
    expect(overview.content).toContain("JP-Insight");
    expect(overview.content).toContain("MQC Assistant");
    expect(overview.content).toContain("manual_upload");
    expect(overview.content).toContain("jurnalpermukiman@pu.go.id");
  });

  it("memperluas sinonim pertanyaan Indonesia untuk portal OJS & JP-Insight", () => {
    expect(expandQueryTerms("Berapa biaya submit di jurnal?")).toContain("apc");
    expect(expandQueryTerms("Bagaimana cara daftar akun OJS?")).toContain("registration");
    expect(expandQueryTerms("Apa itu JP-Insight?")).toContain("asisten cerdas");
  });

  it("mengenali pertanyaan perkenalan asisten tanpa memicu pertanyaan penulis/editor/riset", () => {
    for (const q of [
      "siapa kamu ? ",
      "siapa anda?",
      "kamu ini siapa sih?",
      "perkenalkan dirimu",
      "apa tugasmu?",
      "who are you?",
    ]) {
      expect(isAssistantIdentityQuestion(q)).toBe(true);
      expect(expandQueryTerms(q)).toContain("JP-Insight");
    }

    for (const q of [
      "siapa penulis artikel tentang beton berpori?",
      "siapa editor Jurnal Permukiman?",
      "Berapa harga emas hari ini?",
      "Bagaimana cara daftar akun OJS?",
    ]) {
      expect(isAssistantIdentityQuestion(q)).toBe(false);
    }
  });
});

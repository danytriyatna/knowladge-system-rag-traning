import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { JP_INSIGHT_DOCUMENTS } from "@/lib/jpInsightKnowledge";
import { resolvePortalUrls } from "@/lib/portalExtract";
import { ExternalLink, BookOpen, ShieldCheck, Sparkles, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profil Resmi & Panduan JP-Insight | Jurnal Permukiman KemenPU",
  description:
    "Dokumentasi resmi mengenai cara kerja, sumber data, aturan anti-halusinasi sitasi, serta peran JP-Insight dalam ekosistem Jurnal Permukiman KemenPU.",
};

interface PanduanBlock {
  type: "paragraph" | "list";
  items: string[];
}

interface PanduanSection {
  heading: string;
  blocks: PanduanBlock[];
}

function parsePanduanSections(content: string): {
  lead: string;
  sections: PanduanSection[];
} {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let lead = "";
  const sections: PanduanSection[] = [];
  let current: PanduanSection | null = null;
  let pendingList: string[] = [];

  function flushList() {
    if (!current || pendingList.length === 0) return;
    current.blocks.push({ type: "list", items: pendingList });
    pendingList = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      current = { heading: line.slice(3).trim(), blocks: [] };
      sections.push(current);
      continue;
    }

    if (!current) {
      lead = lead ? `${lead} ${line}` : line;
      continue;
    }

    const bulletMatch = line.match(/^(?:-|•|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      pendingList.push(bulletMatch[1].trim());
    } else {
      flushList();
      current.blocks.push({ type: "paragraph", items: [line] });
    }
  }
  flushList();

  return { lead, sections };
}

export default function PanduanPage() {
  const doc = JP_INSIGHT_DOCUMENTS[0];
  const { lead, sections } = parsePanduanSections(doc?.content ?? "");
  const { publicBaseUrl: ojsPublicUrl } = resolvePortalUrls();
  const mqcPublicUrl =
    process.env.MQC_PUBLIC_URL?.trim() || "http://localhost:3000/dashboard";

  return (
    <div className="flex min-h-screen w-full flex-col puskim-canvas text-foreground">
      <div className="h-1.5 w-full border-b border-[#EAB308]/75 bg-gradient-to-r from-[#0B2347] via-[#123B72] to-[#081A36]" />

      <header className="border-b border-[#D9E1EC] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#D9E1EC] bg-white p-1.5 shadow-xs">
              <Image
                src="/logo-pu.png"
                alt="Logo Kementerian PU"
                width={36}
                height={36}
                className="object-contain"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-[#0F2C59]">
                  JP-Insight
                </span>
                <Badge variant="gold" className="text-[10px] uppercase tracking-wider">
                  Dokumentasi Resmi
                </Badge>
              </div>
              <p className="text-xs text-stone-500">
                Direktorat Bina Teknik Bangunan Gedung dan Penyehatan Lingkungan · KemenPU
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={ojsPublicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-xl border border-[#D9E1EC] bg-white px-3 py-2 text-xs font-semibold text-[#123B72] transition hover:bg-[#EEF4FC]"
            >
              Portal OJS <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href={mqcPublicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-xl border border-[#D9E1EC] bg-white px-3 py-2 text-xs font-semibold text-[#123B72] transition hover:bg-[#EEF4FC]"
            >
              MQC Assistant <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Link
              href="/login"
              className="inline-flex items-center gap-1 rounded-xl bg-[#123B72] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#0B2347]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Masuk Aplikasi
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <div className="fresh-card overflow-hidden rounded-3xl">
          <div className="bg-gradient-to-br from-[#0E3161] via-[#123B72] to-[#081A36] p-6 text-white sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-[#FDE047]">
              <Sparkles className="h-3.5 w-3.5" /> Referensi Sumber Resmi Sistem
            </div>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
              {doc?.title ?? "Profil Resmi, Cara Kerja, dan Panduan JP-Insight"}
            </h1>
            {lead && (
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-blue-100/90">
                {lead}
              </p>
            )}
            {doc?.topics && doc.topics.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {doc.topics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/95"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6 bg-white p-6 sm:p-8">
            {sections.map((section, idx) => (
              <section
                key={section.heading}
                className="rounded-2xl border border-[#E5ECF6] bg-[#FAFBFD] p-5"
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#123B72] text-xs font-bold text-[#FDE047]">
                    {idx + 1}
                  </span>
                  <h2 className="text-base font-bold text-[#0F2C59] sm:text-lg">
                    {section.heading}
                  </h2>
                </div>
                <div className="space-y-2.5 text-sm leading-relaxed text-stone-700">
                  {section.blocks.map((block, bIdx) =>
                    block.type === "list" ? (
                      <ul
                        key={bIdx}
                        className="ml-4 list-disc space-y-1.5 text-stone-700 marker:text-[#123B72]"
                      >
                        {block.items.map((item, iIdx) => (
                          <li key={iIdx}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p key={bIdx}>{block.items[0]}</p>
                    ),
                  )}
                </div>
              </section>
            ))}

            <div className="grid gap-3 border-t border-[#E5ECF6] pt-5 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-2xl border border-[#D9E1EC] bg-[#F8FAFD] p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#123B72]" />
                <div className="text-xs leading-relaxed text-stone-600">
                  <p className="font-bold text-[#0F2C59]">Prinsip Pagar Sitasi Mutlak</p>
                  <p className="mt-0.5">
                    Setiap jawaban pada widget publik maupun aplikasi internal hanya disusun dari korpus resmi terindeks dan diblokir bila tidak memiliki sumber rujukan.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-[#D9E1EC] bg-[#F8FAFD] p-4">
                <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-[#123B72]" />
                <div className="text-xs leading-relaxed text-stone-600">
                  <p className="font-bold text-[#0F2C59]">Kontak Redaksi Resmi</p>
                  <p className="mt-0.5">
                    Pertanyaan pengelolaan naskah atau aktivasi akun OJS ditangani melalui{" "}
                    <a
                      href="mailto:jurnalpermukiman@pu.go.id"
                      className="font-semibold text-[#123B72] underline underline-offset-2"
                    >
                      jurnalpermukiman@pu.go.id
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

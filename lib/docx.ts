import mammoth from "mammoth";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** Extract raw text from a .docx buffer. */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function sanitizeForPdf(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x00-\xff]/g, "?");
}

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const FONT_SIZE = 11;
const LINE_HEIGHT = FONT_SIZE * 1.4;

/**
 * Render plain text as a simple multi-page PDF (Helvetica, wrapped to
 * A4 width). Used so naskah yang galley aslinya bukan PDF (mis. .docx)
 * tetap punya berkas PDF nyata untuk disimpan & dibaca ulang.
 */
export async function textToPdf(title: string, text: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE_WIDTH - MARGIN * 2;

  function wrapLine(input: string, useFont: typeof font): string[] {
    const words = input.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const trial = current ? `${current} ${word}` : word;
      if (useFont.widthOfTextAtSize(trial, FONT_SIZE) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = trial;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  const bodyLines: { text: string; bold?: boolean }[] = [
    ...wrapLine(sanitizeForPdf(title), boldFont).map((l) => ({ text: l, bold: true })),
    { text: "" },
  ];
  const paragraphs = sanitizeForPdf(text).split(/\n+/);
  for (const para of paragraphs) {
    if (!para.trim()) {
      bodyLines.push({ text: "" });
      continue;
    }
    for (const line of wrapLine(para, font)) {
      bodyLines.push({ text: line });
    }
  }

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  for (const line of bodyLines) {
    if (y < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    if (line.text) {
      page.drawText(line.text, {
        x: MARGIN,
        y,
        size: FONT_SIZE,
        font: line.bold ? boldFont : font,
        color: rgb(0, 0, 0),
      });
    }
    y -= LINE_HEIGHT;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

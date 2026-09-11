// pdf-parse (via pdfjs-dist) mengecek globalThis.DOMMatrix di level modul dan
// gagal total kalau tidak ada (Node.js tidak punya DOMMatrix bawaan, itu API
// browser) — makanya import-nya WAJIB dinamis (bukan static di atas file),
// supaya (1) polyfill sempat dipasang lebih dulu, dan (2) route yang cuma
// import fungsi lain dari file ini (mis. GET /api/documents) tidak ikut
// gagal gara-gara pdf-parse dimuat di level modul tanpa benar-benar dipakai.
async function loadPdfParse() {
  if (typeof globalThis.DOMMatrix === "undefined") {
    const { default: DOMMatrix } = await import("dommatrix");
    (globalThis as unknown as { DOMMatrix: unknown }).DOMMatrix = DOMMatrix;
  }
  const { PDFParse } = await import("pdf-parse");
  return PDFParse;
}

export async function extractText(
  buffer: Buffer
): Promise<{ text: string; pageCount: number }> {
  const PDFParse = await loadPdfParse();
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return { text: result.text, pageCount: result.total };
  } finally {
    await parser.destroy();
  }
}

export async function getPageCount(buffer: Buffer): Promise<number> {
  const PDFParse = await loadPdfParse();
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getInfo();
    return result.total;
  } finally {
    await parser.destroy();
  }
}

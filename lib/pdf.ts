import { PDFParse } from "pdf-parse";

export async function extractText(
  buffer: Buffer
): Promise<{ text: string; pageCount: number }> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return { text: result.text, pageCount: result.total };
  } finally {
    await parser.destroy();
  }
}

export async function getPageCount(buffer: Buffer): Promise<number> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getInfo();
    return result.total;
  } finally {
    await parser.destroy();
  }
}

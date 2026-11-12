import fs from "node:fs/promises";
import path from "node:path";

/**
 * Mendapatkan direktori penyimpanan berkas PDF fisik dari variabel lingkungan DOCUMENT_STORAGE_DIR.
 * Default fallback: [process.cwd()]/storage/documents-pdfs
 */
export function getStorageDir(): string {
  const envPath = process.env.DOCUMENT_STORAGE_DIR?.trim();
  if (envPath) {
    return path.isAbsolute(envPath)
      ? envPath
      : path.resolve(/*turbopackIgnore: true*/ process.cwd(), envPath);
  }
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), "storage", "documents-pdfs");
}

/**
 * Memastikan path file aman dari serangan path traversal (..)
 * dan selalu berada di dalam direktori penyimpanan yang sah.
 */
function resolveStoragePath(fileNameOrKey: string): string {
  const baseDir = getStorageDir();
  const safeName = path.basename(fileNameOrKey);
  const resolved = path.resolve(/*turbopackIgnore: true*/ baseDir, safeName);
  const normalizedBase = path.resolve(/*turbopackIgnore: true*/ baseDir);

  if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
    throw new Error("Akses path penyimpanan tidak sah (potensi path traversal terdeteksi).");
  }
  return resolved;
}

/** Object key PDF suatu dokumen — sama dengan yang disimpan di documents.stored_path. */
export function pdfObjectKey(documentId: string): string {
  return `${documentId}.pdf`;
}

/**
 * Menyimpan buffer PDF ke sistem berkas lokal.
 * Folder induk akan dibuat secara otomatis bila belum ada.
 */
export async function uploadPdf(documentId: string, buffer: Buffer): Promise<string> {
  const baseDir = getStorageDir();
  await fs.mkdir(baseDir, { recursive: true });

  const key = pdfObjectKey(documentId);
  const targetPath = resolveStoragePath(key);
  await fs.writeFile(targetPath, buffer);
  return key;
}

/**
 * Membaca buffer berkas PDF dari sistem berkas lokal.
 */
export async function downloadPdf(objectKey: string): Promise<Buffer> {
  const targetPath = resolveStoragePath(objectKey);
  try {
    return await fs.readFile(targetPath);
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error?.code === "ENOENT") {
      throw new Error(`Berkas PDF "${objectKey}" tidak ditemukan di penyimpanan lokal.`);
    }
    throw new Error(`Gagal membaca berkas PDF: ${error?.message || String(err)}`);
  }
}

/**
 * Menghapus berkas PDF dari sistem berkas lokal bila ada.
 */
export async function deletePdf(objectKey: string): Promise<void> {
  const targetPath = resolveStoragePath(objectKey);
  try {
    await fs.unlink(targetPath);
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    // Jika berkas memang tidak ada, abaikan
    if (error?.code !== "ENOENT") {
      throw new Error(`Gagal menghapus berkas PDF: ${error?.message || String(err)}`);
    }
  }
}

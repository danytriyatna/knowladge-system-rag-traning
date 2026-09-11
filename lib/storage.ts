import { createClient } from "@supabase/supabase-js";

const BUCKET = "documents-pdfs";

declare global {
  var __supabaseStorage: ReturnType<typeof createClient> | undefined;
}

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di environment");
  }
  if (!global.__supabaseStorage) {
    // service_role key dipakai — bypass RLS, hanya boleh dipanggil server-side.
    global.__supabaseStorage = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return global.__supabaseStorage;
}

/** Object key PDF suatu dokumen di bucket — sama dengan yang disimpan di documents.stored_path. */
export function pdfObjectKey(documentId: string): string {
  return `${documentId}.pdf`;
}

export async function uploadPdf(documentId: string, buffer: Buffer): Promise<string> {
  const key = pdfObjectKey(documentId);
  const { error } = await getClient()
    .storage.from(BUCKET)
    .upload(key, buffer, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`Gagal upload PDF ke Supabase Storage: ${error.message}`);
  return key;
}

export async function downloadPdf(objectKey: string): Promise<Buffer> {
  const { data, error } = await getClient().storage.from(BUCKET).download(objectKey);
  if (error) throw new Error(`Gagal mengambil PDF dari Supabase Storage: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function deletePdf(objectKey: string): Promise<void> {
  const { error } = await getClient().storage.from(BUCKET).remove([objectKey]);
  if (error) throw new Error(`Gagal menghapus PDF dari Supabase Storage: ${error.message}`);
}

import { describe, it, expect, afterAll } from "vitest";
import { sql } from "@/lib/db";
import { ensureBootstrapAdmin, getUserByEmail, verifyPassword } from "@/lib/auth";
import { uploadPdf, downloadPdf, deletePdf, getStorageDir } from "@/lib/storage";
import fs from "node:fs/promises";
import path from "node:path";

describe("Local PostgreSQL and Disk Storage Migration Test", () => {
  afterAll(async () => {
    await sql.end({ timeout: 2 });
  });

  it("should connect to local PostgreSQL knowledge_db and list tables", async () => {
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    const tableNames = rows.map((r) => r.table_name);
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("documents");
    expect(tableNames).toContain("chunks");
    expect(tableNames).toContain("embeddings");
    expect(tableNames).toContain("chat_history");
  });

  it("should bootstrap admin user and verify password", async () => {
    await ensureBootstrapAdmin();
    const admin = await getUserByEmail("user_dev@test.com");
    expect(admin).toBeDefined();
    expect(admin?.email).toBe("user_dev@test.com");
    expect(admin?.role).toBe("admin");

    const valid = verifyPassword("adminadmin", admin!.password_hash);
    expect(valid).toBe(true);

    const invalid = verifyPassword("wrongpassword", admin!.password_hash);
    expect(invalid).toBe(false);
  });

  it("should save, read, and delete PDF files via local disk storage", async () => {
    const testDocId = "test-migration-" + Date.now();
    const dummyBuffer = Buffer.from("%PDF-1.4 Dummy PDF Content for Migration Test");

    // 1. Upload
    const objectKey = await uploadPdf(testDocId, dummyBuffer);
    expect(objectKey).toBe(`${testDocId}.pdf`);

    // Verify file exists on physical disk
    const diskPath = path.join(getStorageDir(), objectKey);
    const stat = await fs.stat(diskPath);
    expect(stat.size).toBe(dummyBuffer.length);

    // 2. Download
    const downloaded = await downloadPdf(objectKey);
    expect(downloaded.toString("utf8")).toBe(dummyBuffer.toString("utf8"));

    // 3. Delete
    await deletePdf(objectKey);
    await expect(downloadPdf(objectKey)).rejects.toThrow("tidak ditemukan di penyimpanan lokal");
  });

  it("should execute pgvector cosine similarity search natively in knowledge_db", async () => {
    const [{ count }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM embeddings`;
    expect(count).toBeGreaterThanOrEqual(0);

    // Test pgvector <=> operator with 384 dimensions
    const dummyVec = `[${new Array(384).fill(0.05).join(",")}]`;
    const res = await sql<{ sim: number }[]>`
      SELECT (1 - (${dummyVec}::vector <=> ${dummyVec}::vector))::float AS sim
    `;
    expect(res[0].sim).toBeCloseTo(1.0, 5);
  });
});

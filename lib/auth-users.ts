import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { sql, type UserRecord, type UserRole } from "./db";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const candidate = scryptSync(password, salt, 64);
  return candidate.length === hashBuffer.length && timingSafeEqual(candidate, hashBuffer);
}

export async function getUserById(id: string): Promise<UserRecord | undefined> {
  const rows = await sql<UserRecord[]>`SELECT * FROM users WHERE id = ${id}`;
  return rows[0];
}

export async function getUserByEmail(email: string): Promise<UserRecord | undefined> {
  const rows = await sql<UserRecord[]>`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
  return rows[0];
}

export async function createUser(input: {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  unit?: string;
}): Promise<UserRecord> {
  const record: UserRecord = {
    id: randomUUID(),
    email: input.email.toLowerCase(),
    password_hash: hashPassword(input.password),
    full_name: input.fullName,
    role: input.role,
    unit: input.unit ?? null,
    created_at: new Date().toISOString(),
  };
  await sql`
    INSERT INTO users (id, email, password_hash, full_name, role, unit, created_at)
    VALUES (${record.id}, ${record.email}, ${record.password_hash}, ${record.full_name}, ${record.role}, ${record.unit}, ${record.created_at})
  `;
  return record;
}

/**
 * Bootstrap akun admin pertama dari env var, kalau tabel users masih kosong.
 * Tanpa ini tidak ada cara masuk sama sekali di instalasi baru (tidak ada UI
 * pendaftaran mandiri — sesuai desain PRD, akun dibuat/diundang oleh admin).
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  const [{ count }] = await sql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM users`;
  if (count > 0) return;

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  await createUser({ email, password, fullName: "Administrator", role: "admin" });
}

export async function logAudit(
  userId: string,
  action: string,
  targetId?: string,
  detail?: string
): Promise<void> {
  await sql`
    INSERT INTO audit_log (id, user_id, action, target_id, detail, created_at)
    VALUES (${randomUUID()}, ${userId}, ${action}, ${targetId ?? null}, ${detail ?? null}, ${new Date().toISOString()})
  `;
}

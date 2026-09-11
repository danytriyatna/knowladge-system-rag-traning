import { randomUUID, randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { db, type UserRecord, type UserRole } from "./db";

export const SESSION_COOKIE = "jp_session";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 hari

function getSessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) return fromEnv;

  // Simpan secret yang di-generate sekali di storage/ (bukan committed ke git)
  // supaya sesi tidak selalu invalid tiap kali server direstart tanpa perlu
  // pengguna mengonfigurasi env var tambahan secara manual.
  const secretPath = path.join(process.cwd(), "storage", "session-secret.txt");
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, "utf8").trim();
  }
  const generated = randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  fs.writeFileSync(secretPath, generated, "utf8");
  return generated;
}

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

interface SessionPayload {
  userId: string;
  role: UserRole;
  exp: number; // unix seconds
}

export function createSessionToken(userId: string, role: UserRole): string {
  const payload: SessionPayload = {
    userId,
    role,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret()).update(payloadB64).digest("base64url");
  return `${payloadB64}.${signature}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expectedSignature = createHmac("sha256", getSessionSecret())
    .update(payloadB64)
    .digest("base64url");
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_MAX_AGE = SESSION_MAX_AGE_SECONDS;

export function getUserById(id: string): UserRecord | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRecord | undefined;
}

export function getUserByEmail(email: string): UserRecord | undefined {
  return db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase()) as UserRecord | undefined;
}

export function createUser(input: {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  unit?: string;
}): UserRecord {
  const record: UserRecord = {
    id: randomUUID(),
    email: input.email.toLowerCase(),
    password_hash: hashPassword(input.password),
    full_name: input.fullName,
    role: input.role,
    unit: input.unit ?? null,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, role, unit, created_at)
     VALUES (@id, @email, @password_hash, @full_name, @role, @unit, @created_at)`
  ).run(record);
  return record;
}

/**
 * Bootstrap akun admin pertama dari env var, kalau tabel users masih kosong.
 * Tanpa ini tidak ada cara masuk sama sekali di instalasi baru (tidak ada UI
 * pendaftaran mandiri — sesuai desain PRD, akun dibuat/diundang oleh admin).
 */
export function ensureBootstrapAdmin(): void {
  const { count } = db.prepare("SELECT COUNT(*) as count FROM users").get() as {
    count: number;
  };
  if (count > 0) return;

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  createUser({ email, password, fullName: "Administrator", role: "admin" });
}

/** Ambil user yang sedang login dari cookie sesi (Route Handler/Server Component). */
export async function getCurrentUser(): Promise<UserRecord | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  return getUserById(payload.userId) ?? null;
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Wajibkan sudah login. Lempar AuthError(401) kalau belum. */
export async function requireUser(): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "Belum login");
  return user;
}

/** Wajibkan login sebagai admin. Lempar AuthError(401/403) kalau tidak. */
export async function requireAdmin(): Promise<UserRecord> {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new AuthError(403, "Hanya admin yang bisa melakukan ini");
  }
  return user;
}

export function logAudit(userId: string, action: string, targetId?: string, detail?: string): void {
  db.prepare(
    `INSERT INTO audit_log (id, user_id, action, target_id, detail, created_at)
     VALUES (@id, @user_id, @action, @target_id, @detail, @created_at)`
  ).run({
    id: randomUUID(),
    user_id: userId,
    action,
    target_id: targetId ?? null,
    detail: detail ?? null,
    created_at: new Date().toISOString(),
  });
}

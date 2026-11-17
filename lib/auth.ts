import { auth } from "@/auth";
import { type UserRecord } from "./db";
import {
  hashPassword,
  verifyPassword,
  getUserById,
  getUserByEmail,
  createUser,
  ensureBootstrapAdmin,
  logAudit,
} from "./auth-users";

export {
  hashPassword,
  verifyPassword,
  getUserById,
  getUserByEmail,
  createUser,
  ensureBootstrapAdmin,
  logAudit,
};

/** Ambil user yang sedang login dari sesi NextAuth (Route Handler/Server Component). */
export async function getCurrentUser(): Promise<UserRecord | null> {
  if (process.env.DEV_MODE === "true") {
    return {
      id: "dev-admin-dany",
      email: "dany@puskim.pu.go.id",
      password_hash: "",
      full_name: "Dany Triyatna",
      role: "admin",
      unit: "Direktorat Bina Teknik Bangunan Gedung dan Penyehatan Lingkungan",
      created_at: "2026-11-04T00:00:00.000Z",
    };
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return (await getUserById(userId)) ?? null;
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

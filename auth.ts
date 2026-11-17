import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { createBaseAuthConfig } from "@/auth.config";
import {
  ensureBootstrapAdmin,
  getUserByEmail,
  logAudit,
  verifyPassword,
} from "@/lib/auth-users";

export async function authorizeUserCredentials(rawCredentials: unknown) {
  if (!rawCredentials || typeof rawCredentials !== "object") {
    return null;
  }

  const record = rawCredentials as Record<string, unknown>;
  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  const password = typeof record.password === "string" ? record.password : "";

  if (!email || !password) {
    return null;
  }

  await ensureBootstrapAdmin();

  const user = await getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return null;
  }

  await logAudit(user.id, "login");

  return {
    id: user.id,
    email: user.email,
    name: user.full_name,
    fullName: user.full_name,
    role: user.role,
    unit: user.unit,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const base = createBaseAuthConfig();
  return {
    ...base,
    providers: [
      Credentials({
        name: "Akun JP-Insight",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Kata Sandi", type: "password" },
        },
        authorize: authorizeUserCredentials,
      }),
    ],
  };
});

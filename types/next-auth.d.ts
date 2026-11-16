import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      fullName: string;
      role: UserRole;
      unit: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    fullName?: string;
    role?: UserRole;
    unit?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    fullName?: string;
    role?: UserRole;
    unit?: string | null;
  }
}

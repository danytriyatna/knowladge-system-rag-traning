import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    const session = await auth();
    redirect(session ? "/login?expired=1" : "/login");
  }
  return <>{children}</>;
}

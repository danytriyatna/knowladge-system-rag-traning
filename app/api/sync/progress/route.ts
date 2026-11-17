import { NextResponse } from "next/server";
import { getActiveSyncProgress } from "@/lib/harvest";
import { requireAdmin, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const progress = await getActiveSyncProgress();
  return NextResponse.json(progress);
}

import { NextResponse } from "next/server";
import { cancelActiveHarvest } from "@/lib/harvest";
import { requireAdmin, logAudit, AuthError } from "@/lib/auth";

export async function POST(request: Request) {
  let userId: string;
  try {
    const user = await requireAdmin();
    userId = user.id;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const body = await request.json().catch(() => ({}));
  const syncRunId = typeof body?.syncRunId === "string" ? body.syncRunId : undefined;

  const result = await cancelActiveHarvest(syncRunId);
  try {
    await logAudit(userId, "sync_cancelled", syncRunId ?? "unknown", result.message);
  } catch {
    // Abaikan kegagalan audit log
  }

  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { runHarvest, HarvestAlreadyRunningError } from "@/lib/harvest";
import { requireAdmin, logAudit, AuthError } from "@/lib/auth";

// Harvest penuh (ratusan naskah, unduh + ekstrak + chunk + embed per naskah)
// bisa memakan waktu lama secara sinkron.
export const maxDuration = 300;

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const body = await request.json().catch(() => ({}));
  const limit =
    typeof body?.limit === "number" && body.limit > 0 ? Math.floor(body.limit) : undefined;

  try {
    const outcome = await runHarvest({ limit });
    logAudit(user.id, "sync_triggered", outcome.syncRunId, `status=${outcome.status}`);
    return NextResponse.json(outcome);
  } catch (err) {
    if (err instanceof HarvestAlreadyRunningError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}

import { NextResponse } from "next/server";
import {
  runHarvest,
  startHarvestBackground,
  HarvestAlreadyRunningError,
} from "@/lib/harvest";
import { requireAdmin, logAudit, AuthError } from "@/lib/auth";

export const maxDuration = 300;

export async function POST(request: Request) {
  let userId = "cron_system";

  // Cek apakah dipanggil oleh Cron Job otomatis (Vercel Cron / Scheduled Webhook)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = Boolean(
    cronSecret &&
      (authHeader === `Bearer ${cronSecret}` || request.headers.get("x-cron-key") === cronSecret),
  );

  if (!isCron) {
    try {
      const user = await requireAdmin();
      userId = user.id;
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  }

  const body = await request.json().catch(() => ({}));
  const limit =
    typeof body?.limit === "number" && body.limit > 0 ? Math.floor(body.limit) : undefined;
  const isSyncMode = body?.mode === "sync" || isCron;

  try {
    if (isSyncMode) {
      const outcome = await runHarvest({ limit });
      try {
        await logAudit(userId, "sync_triggered", outcome.syncRunId, `status=${outcome.status}`);
      } catch {
        // Abaikan jika log audit gagal saat cron
      }
      return NextResponse.json(outcome);
    }

    // Default: Background Non-blocking Execution (respons instan HTTP 202)
    const { syncRunId } = await startHarvestBackground({ limit });
    try {
      await logAudit(userId, "sync_triggered", syncRunId, "status=started");
    } catch {
      // Abaikan jika log audit gagal
    }
    return NextResponse.json(
      { syncRunId, status: "started", message: "Sinkronisasi dimulai di latar belakang" },
      { status: 202 }
    );
  } catch (err) {
    if (err instanceof HarvestAlreadyRunningError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}

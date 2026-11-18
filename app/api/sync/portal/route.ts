import { NextResponse } from "next/server";
import { runPortalAndInfoSync } from "@/lib/portalSync";
import { requireAdmin, logAudit, AuthError } from "@/lib/auth";

export const maxDuration = 300;

export async function POST(request: Request) {
  let userId = "cron_system";

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
  const includePortal = typeof body?.includePortal === "boolean" ? body.includePortal : true;
  const includeJpInsightInfo =
    typeof body?.includeJpInsightInfo === "boolean" ? body.includeJpInsightInfo : true;

  try {
    const summary = await runPortalAndInfoSync({ includePortal, includeJpInsightInfo });
    try {
      await logAudit(
        userId,
        "portal_sync_triggered",
        undefined,
        `created=${summary.created} updated=${summary.updated} skipped=${summary.skipped} failed=${summary.failed}`,
      );
    } catch {
      // Abaikan jika log audit gagal saat cron
    }
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menyinkronkan portal OJS";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

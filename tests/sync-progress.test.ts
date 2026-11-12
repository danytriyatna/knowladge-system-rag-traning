import { describe, it, expect } from "vitest";
import { sql } from "@/lib/db";
import {
  getActiveSyncProgress,
  cancelActiveHarvest,
  startHarvestBackground,
} from "@/lib/harvest";

describe("Sync Progress and Cancellation Test", () => {
  it("should get progress structure without error", async () => {
    const progress = await getActiveSyncProgress();
    expect(progress).toHaveProperty("isRunning");
    expect(typeof progress.isRunning).toBe("boolean");
  });

  it("should start background harvest and report progress", async () => {
    const { syncRunId } = await startHarvestBackground({ limit: 1 });
    expect(syncRunId).toBeDefined();

    const progress = await getActiveSyncProgress();
    expect(progress.isRunning).toBe(true);
    expect(progress.activeRun?.syncRunId).toBe(syncRunId);

    // Cancel it safely
    const cancelResult = await cancelActiveHarvest(syncRunId);
    expect(cancelResult.success).toBe(true);

    const [cancelledRow] = await sql<{ status: string }[]>`
      SELECT status FROM sync_runs WHERE id = ${syncRunId}
    `;
    expect(cancelledRow?.status).toBe("cancelled");
  });
});

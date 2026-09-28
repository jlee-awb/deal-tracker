import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { deals, dealDetails, dealUpdates, pendingSyncChanges } from "../db/schema";
import { getAdapter } from "./adapters";
import { dealToSheetRow, lastSnapshotRow, snapshotRow, serializeSnapshot } from "./mapping";
import { planSync, pendingKey, PendingKind } from "./plan";

export interface SyncPullSummary {
  pulled: number;
  newDeals: number;
  queuedOutbound: number;
  queuedConflicts: number;
  queuedRemoved: number;
  supersededOutbound: number;
}

/**
 * One full pull cycle: reads the live sheet, diffs it against the app's
 * current state and the last agreed snapshot, auto-applies everything
 * that's safe (the sheet changed, the app didn't), and queues everything
 * else — conflicts and app-originated changes — for manual review. Never
 * writes anything back to the sheet; that only happens via runPush, and
 * only for rows a human has explicitly approved.
 */
export async function runSyncPull(): Promise<SyncPullSummary> {
  const adapter = getAdapter();

  const [dealRows, existingPendingRows, sheetRows] = await Promise.all([
    db.select().from(deals),
    db.select().from(pendingSyncChanges).where(eq(pendingSyncChanges.status, "pending")),
    adapter.readCurrentSheet(),
  ]);

  const appRows = dealRows.map(dealToSheetRow);
  const lastSnapshotRows = dealRows.map(lastSnapshotRow);
  const existingPendingKeys = new Set(
    existingPendingRows.map((p) => pendingKey(p.dealId, p.kind as PendingKind, p.field))
  );

  const plan = planSync(sheetRows, appRows, lastSnapshotRows, existingPendingKeys);
  const dealById = new Map(dealRows.map((d) => [d.id, d]));

  await db.transaction(async (tx) => {
    for (const update of plan.dealFieldUpdates) {
      // Dynamic column name: SyncedField values are defined to match the
      // `deals` schema's own field names 1:1 (see src/sync/types.ts).
      await tx
        .update(deals)
        .set({ [update.field]: update.newValue, updatedAt: new Date() } as Record<string, unknown>)
        .where(eq(deals.id, update.dealId));
    }

    for (const log of plan.dealUpdateLogs) {
      await tx.insert(dealUpdates).values({
        id: randomUUID(),
        dealId: log.dealId,
        occurredAt: new Date().toISOString().slice(0, 10),
        field: log.field,
        oldValue: log.oldValue,
        newValue: log.newValue,
        statusAtTime: dealById.get(log.dealId)?.status ?? null,
        source: log.source,
        note: log.note ?? null,
      });
    }

    for (const su of plan.snapshotUpdates) {
      const deal = dealById.get(su.dealId);
      if (!deal) continue;
      await tx
        .update(deals)
        .set({ lastSyncedSnapshot: serializeSnapshot(snapshotRow(deal, su.fields)) })
        .where(eq(deals.id, su.dealId));
    }

    for (const row of plan.newDeals) {
      await tx
        .insert(deals)
        .values({
          id: row.key,
          dealName: row.dealName,
          sponsors: row.sponsors,
          bank: row.bank,
          ccy: row.ccy,
          amountMM: row.amountMM,
          premium: row.premium,
          tenorYears: row.tenorYears,
          insuredPct: row.insuredPct,
          latestCommDate: row.latestCommDate,
          statusUpdate: row.statusUpdate,
          nextStep: row.nextStep,
          underwritingStatus: row.underwritingStatus,
          coveredBy: row.coveredBy,
          status: row.status,
          lastSyncedSnapshot: serializeSnapshot(row),
        })
        .onConflictDoNothing();
      await tx
        .insert(dealDetails)
        .values({ dealId: row.key, personalNotes: "", tags: "[]", linkedEmails: "[]", priorityFlag: false })
        .onConflictDoNothing();
    }

    for (const s of plan.supersedes) {
      await tx
        .update(pendingSyncChanges)
        .set({ status: "superseded" })
        .where(
          and(
            eq(pendingSyncChanges.dealId, s.dealId),
            eq(pendingSyncChanges.field, s.field),
            eq(pendingSyncChanges.kind, s.supersededKind),
            eq(pendingSyncChanges.status, "pending")
          )
        );
    }

    for (const p of plan.pendingUpserts) {
      await tx.insert(pendingSyncChanges).values({
        id: randomUUID(),
        dealId: p.dealId,
        kind: p.kind,
        field: p.field,
        oldValue: p.oldValue,
        newValue: p.newValue,
        sheetValue: p.sheetValue,
        status: "pending",
      });
    }
  });

  return {
    pulled: plan.dealFieldUpdates.length,
    newDeals: plan.newDeals.length,
    queuedOutbound: plan.pendingUpserts.filter((p) => p.kind === "outbound").length,
    queuedConflicts: plan.pendingUpserts.filter((p) => p.kind === "conflict").length,
    queuedRemoved: plan.pendingUpserts.filter((p) => p.kind === "removed_from_sheet").length,
    supersededOutbound: plan.supersedes.length,
  };
}

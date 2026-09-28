// The human-decision half of the review queue: what happens when Joseph
// acts on one pendingSyncChanges row. Deliberately separate from runSync
// (which only ever adds rows here) and runPush (which only ever acts on
// rows already marked 'approved') — this is the one place a 'pending' row
// changes state because a person decided something.

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { deals, dealUpdates, pendingSyncChanges } from "../db/schema";
import { snapshotRow, serializeSnapshot } from "./mapping";

export type ConflictResolution = "keep_app" | "keep_sheet" | { custom: string };

/** Outbound row: approve queues it for the next push. No resolution needed
 * — there's only one candidate value (the app's). */
export async function approveOutbound(pendingId: string): Promise<void> {
  await db.update(pendingSyncChanges).set({ status: "approved" }).where(eq(pendingSyncChanges.id, pendingId));
}

export async function rejectOutbound(pendingId: string): Promise<void> {
  await db.update(pendingSyncChanges).set({ status: "rejected" }).where(eq(pendingSyncChanges.id, pendingId));
}

/**
 * Resolves a conflict. 'keep_app' and a custom value are queued for the
 * next push (the sheet needs to be told). 'keep_sheet' needs no push at
 * all — the sheet already has the value — so it's applied to the app
 * immediately, the same way a plain pull would.
 */
export async function resolveConflict(pendingId: string, resolution: ConflictResolution): Promise<void> {
  const [row] = await db.select().from(pendingSyncChanges).where(eq(pendingSyncChanges.id, pendingId));
  if (!row || row.kind !== "conflict" || !row.field) {
    throw new Error(`pendingSyncChanges row ${pendingId} is not a resolvable conflict`);
  }

  if (resolution === "keep_sheet") {
    const [deal] = await db.select().from(deals).where(eq(deals.id, row.dealId));
    if (!deal) throw new Error(`deal ${row.dealId} not found`);
    const value = row.sheetValue ?? "";
    const field = row.field;

    await db.transaction(async (tx) => {
      await tx
        .update(deals)
        .set({ [field]: value, lastSyncedSnapshot: serializeSnapshot(snapshotRow(deal, { [field]: value })) } as Record<
          string,
          unknown
        >)
        .where(eq(deals.id, row.dealId));
      await tx.insert(dealUpdates).values({
        id: randomUUID(),
        dealId: row.dealId,
        occurredAt: new Date().toISOString().slice(0, 10),
        field,
        oldValue: (deal as unknown as Record<string, string | null>)[field] ?? null,
        newValue: value,
        statusAtTime: deal.status,
        source: "sheet_edit",
        note: "Conflict resolved: kept the spreadsheet's value.",
      });
      await tx
        .update(pendingSyncChanges)
        .set({ status: "synced", resolution: "keep_sheet" })
        .where(eq(pendingSyncChanges.id, pendingId));
    });
    return;
  }

  const resolutionLabel = resolution === "keep_app" ? "keep_app" : `custom:${resolution.custom}`;
  await db
    .update(pendingSyncChanges)
    .set({ status: "approved", resolution: resolutionLabel })
    .where(eq(pendingSyncChanges.id, pendingId));
}

/**
 * A deal that disappeared from the live sheet since the last sync. For now
 * this only acknowledges the review item — it does not move the deal into
 * archiveDeals or change its status, since doing that automatically would
 * mean deciding, unasked, whether to keep or discard the deal's own
 * dealUpdates history (archiveDeals has no history table of its own, and
 * cascading the delete would erase it). That decision belongs to Joseph
 * once this is revisited, not baked in silently here.
 */
export async function acknowledgeRemoved(pendingId: string): Promise<void> {
  await db
    .update(pendingSyncChanges)
    .set({ status: "resolved", resolution: "acknowledged" })
    .where(eq(pendingSyncChanges.id, pendingId));
}

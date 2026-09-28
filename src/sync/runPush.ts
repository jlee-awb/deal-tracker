import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { deals, pendingSyncChanges } from "../db/schema";
import { getAdapter } from "./adapters";
import { snapshotRow, serializeSnapshot } from "./mapping";
import { FieldChange, SyncedField } from "./types";

export interface PushSummary {
  pushed: number;
}

function resolvedValue(p: { newValue: string | null; resolution: string | null }): string {
  if (p.resolution?.startsWith("custom:")) return p.resolution.slice("custom:".length);
  return p.newValue ?? "";
}

/**
 * Writes every approved change (clean outbound pushes, plus conflicts
 * resolved in the app's favor or with a custom value) to the live sheet in
 * one batch, then marks each row synced and advances its snapshot so it
 * won't be re-diffed as a divergence next cycle. Only ever touches rows
 * already in status 'approved' — nothing here makes an approval decision.
 */
export async function runPush(): Promise<PushSummary> {
  const approved = await db
    .select()
    .from(pendingSyncChanges)
    .where(and(eq(pendingSyncChanges.status, "approved"), inArray(pendingSyncChanges.kind, ["outbound", "conflict"])));

  const toPush = approved.filter((p) => p.field);
  if (toPush.length === 0) return { pushed: 0 };

  const adapter = getAdapter();
  const changes: FieldChange[] = toPush.map((p) => ({
    key: p.dealId,
    field: p.field as SyncedField,
    oldValue: p.oldValue ?? "",
    newValue: resolvedValue(p),
  }));
  await adapter.writeChanges(changes, []);

  const dealRows = await db
    .select()
    .from(deals)
    .where(
      inArray(
        deals.id,
        toPush.map((p) => p.dealId)
      )
    );
  const dealById = new Map(dealRows.map((d) => [d.id, d]));

  await db.transaction(async (tx) => {
    for (const p of toPush) {
      const value = resolvedValue(p);
      const field = p.field as string;
      const deal = dealById.get(p.dealId);

      // A custom resolution isn't yet reflected in `deals` (unlike a plain
      // outbound push or "keep_app", where the app's own value already is
      // what's being pushed) — write it through now that the sheet agrees.
      if (p.resolution?.startsWith("custom:") && deal) {
        await tx.update(deals).set({ [field]: value } as Record<string, unknown>).where(eq(deals.id, p.dealId));
      }
      if (deal) {
        await tx
          .update(deals)
          .set({ lastSyncedSnapshot: serializeSnapshot(snapshotRow(deal, { [field]: value } as Record<string, string>)) })
          .where(eq(deals.id, p.dealId));
      }
      await tx.update(pendingSyncChanges).set({ status: "synced" }).where(eq(pendingSyncChanges.id, p.id));
    }
  });

  return { pushed: toPush.length };
}

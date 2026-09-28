// Pure planning layer between reconcile() and the database. Takes the
// engine's output and works out exactly what rows to write — but performs
// no I/O itself, so it's fully unit-testable without a live Postgres
// connection (see __tests__/plan.test approach: same throwaway-fixture
// style as reconcile's own tests).

import { SheetDealRow, SyncedField } from "./types";
import { reconcile } from "./reconcile";

export type PendingKind = "outbound" | "conflict" | "removed_from_sheet";

export interface DealFieldUpdate {
  dealId: string;
  field: SyncedField;
  oldValue: string;
  newValue: string;
}

export interface DealUpdateLog {
  dealId: string;
  field: SyncedField | null;
  oldValue: string | null;
  newValue: string | null;
  source: "sheet_edit";
  note?: string;
}

export interface SnapshotUpdate {
  dealId: string;
  fields: Partial<Record<SyncedField, string>>;
}

export interface PendingUpsert {
  dealId: string;
  kind: PendingKind;
  field: SyncedField | null;
  oldValue: string | null;
  newValue: string | null;
  sheetValue: string | null;
}

export interface SupersedeInstruction {
  dealId: string;
  field: SyncedField;
  /** The kind of the now-stale pending row to mark 'superseded' rather than
   * leave dangling as 'pending' forever. */
  supersededKind: PendingKind;
}

export interface SyncPlan {
  /** Safe to apply directly to `deals` — the sheet changed, the app hadn't. */
  dealFieldUpdates: DealFieldUpdate[];
  /** Brand-new rows that appeared directly in the sheet. */
  newDeals: SheetDealRow[];
  dealUpdateLogs: DealUpdateLog[];
  /** Per-deal partial snapshot advances — only for fields just pulled in;
   * outbound/conflict fields keep their old snapshot value until resolved. */
  snapshotUpdates: SnapshotUpdate[];
  /** New review-queue rows to insert (already deduped against what's
   * already pending). */
  pendingUpserts: PendingUpsert[];
  /** Existing pending rows to mark superseded because the same field has
   * since escalated from a clean outbound push to a genuine conflict. */
  supersedes: SupersedeInstruction[];
  /** Deal keys that vanished from the sheet since the last sync — surfaced
   * via pendingUpserts (kind: removed_from_sheet); listed again here too,
   * plainly, for a caller that wants the raw list without filtering. */
  removedFromSheetKeys: string[];
}

export function pendingKey(dealId: string, kind: PendingKind, field: string | null): string {
  return `${dealId}::${kind}::${field ?? ""}`;
}

/**
 * @param existingPendingKeys keys (via pendingKey) of every pendingSyncChanges
 *   row currently in status 'pending', so re-running a pull is idempotent —
 *   it never re-queues something already awaiting a decision.
 */
export function planSync(
  sheetRows: SheetDealRow[],
  appRows: SheetDealRow[],
  lastSnapshotRows: SheetDealRow[],
  existingPendingKeys: ReadonlySet<string>
): SyncPlan {
  const { pull, outbound } = reconcile(sheetRows, appRows, lastSnapshotRows);

  const dealFieldUpdates: DealFieldUpdate[] = pull.externalChanges.map((c) => ({
    dealId: c.key,
    field: c.field,
    oldValue: c.oldValue,
    newValue: c.newValue,
  }));

  const dealUpdateLogs: DealUpdateLog[] = pull.externalChanges.map((c) => ({
    dealId: c.key,
    field: c.field,
    oldValue: c.oldValue,
    newValue: c.newValue,
    source: "sheet_edit",
  }));
  for (const newRow of pull.newRows) {
    dealUpdateLogs.push({
      dealId: newRow.key,
      field: null,
      oldValue: null,
      newValue: null,
      source: "sheet_edit",
      note: "Added directly in the spreadsheet.",
    });
  }

  const snapshotByDeal = new Map<string, Partial<Record<SyncedField, string>>>();
  for (const c of pull.externalChanges) {
    const existing = snapshotByDeal.get(c.key) ?? {};
    existing[c.field] = c.newValue;
    snapshotByDeal.set(c.key, existing);
  }
  const snapshotUpdates: SnapshotUpdate[] = Array.from(snapshotByDeal.entries()).map(
    ([dealId, fields]) => ({ dealId, fields })
  );

  const pendingUpserts: PendingUpsert[] = [];
  const supersedes: SupersedeInstruction[] = [];

  for (const c of outbound.toQueue) {
    const key = pendingKey(c.key, "outbound", c.field);
    if (existingPendingKeys.has(key)) continue;
    pendingUpserts.push({
      dealId: c.key,
      kind: "outbound",
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue,
      sheetValue: null,
    });
  }

  for (const c of outbound.conflicts) {
    const conflictKey = pendingKey(c.key, "conflict", c.field);
    // A field that was previously a clean outbound push (sheet hadn't
    // touched it yet) can escalate into a conflict once the sheet changes
    // too. The stale outbound row would otherwise sit there forever as
    // 'pending' alongside the new conflict — flag it for supersession.
    const staleOutboundKey = pendingKey(c.key, "outbound", c.field);
    if (existingPendingKeys.has(staleOutboundKey)) {
      supersedes.push({ dealId: c.key, field: c.field, supersededKind: "outbound" });
    }
    if (existingPendingKeys.has(conflictKey)) continue;
    pendingUpserts.push({
      dealId: c.key,
      kind: "conflict",
      field: c.field,
      oldValue: c.lastSyncedValue,
      newValue: c.appValue,
      sheetValue: c.sheetValue,
    });
  }

  for (const removedKey of pull.removedFromSheet) {
    const key = pendingKey(removedKey, "removed_from_sheet", null);
    if (existingPendingKeys.has(key)) continue;
    pendingUpserts.push({
      dealId: removedKey,
      kind: "removed_from_sheet",
      field: null,
      oldValue: null,
      newValue: null,
      sheetValue: null,
    });
  }

  return {
    dealFieldUpdates,
    newDeals: pull.newRows,
    dealUpdateLogs,
    snapshotUpdates,
    pendingUpserts,
    supersedes,
    removedFromSheetKeys: pull.removedFromSheet,
  };
}

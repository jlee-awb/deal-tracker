import {
  SheetDealRow,
  SYNCED_FIELDS,
  FieldChange,
  PullResult,
  OutboundDiff,
  Conflict,
} from "./types";

function byKey(rows: SheetDealRow[]): Map<string, SheetDealRow> {
  return new Map(rows.map((r) => [r.key, r]));
}

/** Every SYNCED_FIELDS diff between two versions of the same row set,
 * relative to a common baseline (`from`). Used for both "what changed in
 * the sheet since the last sync" and "what changed in the app since the
 * last sync" — same function, different inputs. */
function diffFields(from: SheetDealRow[], to: SheetDealRow[]): FieldChange[] {
  const fromMap = byKey(from);
  const changes: FieldChange[] = [];
  for (const row of to) {
    const prior = fromMap.get(row.key);
    if (!prior) continue; // new rows are handled separately, not as field diffs
    for (const field of SYNCED_FIELDS) {
      const oldValue = prior[field] ?? "";
      const newValue = row[field] ?? "";
      if (oldValue !== newValue) {
        changes.push({ key: row.key, field, oldValue, newValue });
      }
    }
  }
  return changes;
}

/** Step 1 of a sync cycle: what changed in the live sheet since the last
 * confirmed snapshot. Read-only against the sheet — always safe to
 * auto-apply, since this direction can never clobber anyone's edit. */
export function diffIncomingSheet(
  sheetRows: SheetDealRow[],
  lastSnapshot: SheetDealRow[]
): { changed: FieldChange[]; newRows: SheetDealRow[]; removedFromSheet: string[] } {
  const snapshotMap = byKey(lastSnapshot);
  const sheetMap = byKey(sheetRows);

  const newRows = sheetRows.filter((r) => !snapshotMap.has(r.key));
  const removedFromSheet = lastSnapshot.map((r) => r.key).filter((k) => !sheetMap.has(k));
  const changed = diffFields(lastSnapshot, sheetRows).filter((c) => snapshotMap.has(c.key));

  return { changed, newRows, removedFromSheet };
}

/**
 * The full reconciliation for one sync cycle. Takes the live sheet state,
 * the app's current state, and the last snapshot both sides are known to
 * have agreed on, and produces: what to pull in (safe, automatic), what's
 * a genuine conflict (surfaced, never auto-resolved), and what's still
 * queued to push out (gated behind manual approval upstream of this).
 */
export function reconcile(
  sheetRows: SheetDealRow[],
  appRows: SheetDealRow[],
  lastSnapshot: SheetDealRow[]
): {
  pull: PullResult;
  outbound: OutboundDiff;
} {
  const { changed: sheetChanges, newRows, removedFromSheet } = diffIncomingSheet(
    sheetRows,
    lastSnapshot
  );
  const appChanges = diffFields(lastSnapshot, appRows);

  const sheetChangeKey = (c: FieldChange) => `${c.key}::${c.field}`;
  const sheetChangesByKey = new Map(sheetChanges.map((c) => [sheetChangeKey(c), c]));
  const appChangesByKey = new Map(appChanges.map((c) => [sheetChangeKey(c), c]));

  const externalChanges: FieldChange[] = [];
  const conflicts: Conflict[] = [];
  const lastSnapshotMap = byKey(lastSnapshot);

  for (const sc of sheetChanges) {
    const ac = appChangesByKey.get(sheetChangeKey(sc));
    if (!ac) {
      // Only the sheet changed this field — safe to pull straight in.
      externalChanges.push(sc);
    } else if (ac.newValue === sc.newValue) {
      // Both sides converged on the same value independently — nothing to
      // pull, nothing to push, no conflict.
      continue;
    } else {
      // Both sides changed the same field to different values since the
      // last sync. Never auto-resolved.
      conflicts.push({
        key: sc.key,
        field: sc.field,
        sheetValue: sc.newValue,
        appValue: ac.newValue,
        lastSyncedValue: lastSnapshotMap.get(sc.key)?.[sc.field] ?? "",
      });
    }
  }

  const toQueue = appChanges.filter((ac) => !sheetChangesByKey.has(sheetChangeKey(ac)));

  return {
    pull: { externalChanges, newRows, removedFromSheet },
    outbound: { toQueue, conflicts },
  };
}

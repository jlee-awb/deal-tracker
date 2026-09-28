// Pure conversions between the app's DB row shape and the sync engine's
// adapter-agnostic SheetDealRow. Nothing here touches the database or the
// sheet — it's just the translation layer both directions go through.

import { deals } from "../db/schema";
import { SheetDealRow, SYNCED_FIELDS } from "./types";

export type DealDbRow = typeof deals.$inferSelect;

const asText = (v: string | null | undefined) => v ?? "";

/** The app's current state for one deal, in sync-engine shape. */
export function dealToSheetRow(deal: DealDbRow): SheetDealRow {
  return {
    key: deal.id,
    dealName: deal.dealName,
    sponsors: asText(deal.sponsors),
    bank: deal.bank,
    ccy: asText(deal.ccy),
    amountMM: asText(deal.amountMM),
    premium: asText(deal.premium),
    tenorYears: asText(deal.tenorYears),
    insuredPct: asText(deal.insuredPct),
    latestCommDate: asText(deal.latestCommDate),
    statusUpdate: asText(deal.statusUpdate),
    nextStep: asText(deal.nextStep),
    underwritingStatus: asText(deal.underwritingStatus),
    coveredBy: asText(deal.coveredBy),
    status: deal.status,
  };
}

/**
 * The last-confirmed-synced state for one deal, parsed from its stored
 * snapshot JSON. Returns null when the deal has never been through a sync
 * cycle (the phase-1 synthetic seed rows, before any real sheet exists) —
 * callers fall back to treating the app's current row as the baseline in
 * that case, since there is nothing else to diff against.
 */
export function parseSnapshot(deal: DealDbRow): Partial<Record<(typeof SYNCED_FIELDS)[number], string>> | null {
  if (!deal.lastSyncedSnapshot) return null;
  try {
    const parsed = JSON.parse(deal.lastSyncedSnapshot);
    if (parsed && typeof parsed === "object") return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Builds a full SheetDealRow snapshot for a deal, applying any partial
 * field overrides on top of its current DB values. Used both to seed the
 * fallback snapshot (no overrides) and to write an updated snapshot after
 * fields are pulled in (overrides = the newly-synced values). */
export function snapshotRow(
  deal: DealDbRow,
  overrides?: Partial<Record<(typeof SYNCED_FIELDS)[number], string>>
): SheetDealRow {
  const base = dealToSheetRow(deal);
  return overrides ? { ...base, ...overrides } : base;
}

/** The full last-synced SheetDealRow for a deal, falling back to its
 * current app values when it has never been through a sync cycle. This is
 * what reconcile() should receive as `lastSnapshot` for this deal. */
export function lastSnapshotRow(deal: DealDbRow): SheetDealRow {
  return snapshotRow(deal, parseSnapshot(deal) ?? undefined);
}

export function serializeSnapshot(row: SheetDealRow): string {
  const snapshot: Record<string, string> = {};
  for (const field of SYNCED_FIELDS) snapshot[field] = row[field];
  return JSON.stringify(snapshot);
}

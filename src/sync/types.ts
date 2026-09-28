// Shared types for the two-way sync engine. Deliberately independent of any
// particular Excel access method (local file vs. Microsoft Graph) — an
// "adapter" produces/consumes SheetDealRow[], and everything in reconcile.ts
// only ever talks to that shape. This is what makes it possible to fully
// test the actual merge/conflict logic against a throwaway local .xlsx
// without touching Weekly Update.xlsx or needing live Graph credentials.

/** The MD-facing fields — 1:1 with Weekly Update.xlsx's "Current" sheet
 * columns B–Q. This is the ONLY data that ever crosses the sync boundary. */
export interface SheetDealRow {
  /** Stable identity key: slug(dealName, bank). Not itself a sheet column —
   * computed from dealName + bank so row reordering in Excel never breaks
   * matching. */
  key: string;
  dealName: string;
  sponsors: string;
  bank: string;
  ccy: string;
  amountMM: string;
  premium: string;
  tenorYears: string;
  insuredPct: string;
  latestCommDate: string; // ISO date
  statusUpdate: string;
  nextStep: string;
  underwritingStatus: string;
  coveredBy: string;
  status: string;
}

/** The subset of SheetDealRow fields the sync engine is allowed to diff and
 * write. Deliberately excludes dealName/bank (identity, not "changeable"
 * in the reconciliation sense — a rename is handled as remove+add) and
 * dayCount/usdEqvMM (formula-derived on the real sheet; never plain input). */
export const SYNCED_FIELDS = [
  "sponsors",
  "ccy",
  "amountMM",
  "premium",
  "tenorYears",
  "insuredPct",
  "latestCommDate",
  "statusUpdate",
  "nextStep",
  "underwritingStatus",
  "coveredBy",
  "status",
] as const;
export type SyncedField = (typeof SYNCED_FIELDS)[number];

export interface FieldChange {
  key: string; // deal key
  field: SyncedField;
  oldValue: string;
  newValue: string;
}

export interface PullResult {
  /** Changes found in the sheet that the app didn't already know about —
   * safe to auto-apply, since pulling never overwrites anyone. */
  externalChanges: FieldChange[];
  /** Deal keys present in the sheet but not yet known to the app at all. */
  newRows: SheetDealRow[];
  /** Deal keys the app knows about that have disappeared from the sheet —
   * surfaced for a human decision, never auto-deleted. */
  removedFromSheet: string[];
}

export interface Conflict {
  key: string;
  field: SyncedField;
  sheetValue: string; // what's now in the sheet (already pulled in)
  appValue: string; // what the app has, changed independently since the last sync
  lastSyncedValue: string; // the common ancestor both diverged from
}

export interface OutboundDiff {
  /** App changes that are clear to queue for push — the sheet hasn't
   * touched this field since the last sync. */
  toQueue: FieldChange[];
  /** Same-field changes on both sides — never auto-resolved. */
  conflicts: Conflict[];
}

/** An adapter is anything that can read/write a "Current"-sheet-shaped
 * table of SheetDealRow — a local .xlsx file (for testing) or Microsoft
 * Graph against the real workbook (for production). */
export interface SheetAdapter {
  readCurrentSheet(): Promise<SheetDealRow[]>;
  /** Writes approved field changes and appends any brand-new deals.
   * Must never touch formula columns, and must never touch a row's
   * identity fields (dealName/bank) — only SYNCED_FIELDS values. */
  writeChanges(changes: FieldChange[], newDeals: SheetDealRow[]): Promise<void>;
}

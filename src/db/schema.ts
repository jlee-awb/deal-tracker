import { pgTable, text, real, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * `deals` mirrors the "Current" sheet of Weekly Update.xlsx column-for-column.
 * These are the ONLY fields that ever get pushed back to the spreadsheet.
 * Keyed by (dealName, bank) since the real sheet has the same deal name
 * appear against multiple counterparty banks as separate pipeline rows
 * (e.g. "Project Broadway" x SMBC and x Nomura are two distinct rows).
 */
export const deals = pgTable("deals", {
  id: text("id").primaryKey(), // slug of dealName + bank
  dealName: text("deal_name").notNull(),
  sponsors: text("sponsors"),
  bank: text("bank").notNull(),
  ccy: text("ccy"),
  amountMM: text("amount_mm"), // kept as text: source mixes "10.0", "TBC", "72.0 (USD 10.0)"
  usdEqvMM: real("usd_eqv_mm"),
  premium: text("premium"),
  dayCount: text("day_count"),
  tenorYears: text("tenor_years"),
  insuredPct: text("insured_pct"),
  latestCommDate: text("latest_comm_date"), // ISO date (kept as text, mirrors sheet)
  statusUpdate: text("status_update"),
  nextStep: text("next_step"),
  underwritingStatus: text("underwriting_status"),
  coveredBy: text("covered_by"), // analyst initials
  status: text("status").notNull(), // Early Discussion / On Hold / Closed / Dropped / Rejected / Turned Down

  // bookkeeping for the two-way sync (phase 4) — not part of the sheet schema
  lastSyncedSnapshot: text("last_synced_snapshot"), // JSON of the values last confirmed to match the live sheet
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * `dealDetails` is the "over and above the spreadsheet" layer — for Joseph's
 * own reference only. Never read from or written to Weekly Update.xlsx.
 */
export const dealDetails = pgTable("deal_details", {
  dealId: text("deal_id").primaryKey().references(() => deals.id, { onDelete: "cascade" }),
  personalNotes: text("personal_notes"),
  riskNotes: text("risk_notes"),
  tags: text("tags"), // JSON array
  linkedEmails: text("linked_emails"), // JSON array of {subject, webLink}
  priorityFlag: boolean("priority_flag").default(false),
});

/**
 * `dealUpdates` is the append-only chronological log — every change to a
 * deal from either direction, timestamped and attributed. This is what the
 * per-deal timeline (prev/next navigation) is built from.
 */
export const dealUpdates = pgTable("deal_updates", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  occurredAt: text("occurred_at").notNull(), // ISO date the update reflects (Latest Communication date)
  field: text("field"), // which field changed; null = general status-update note
  oldValue: text("old_value"),
  newValue: text("new_value"),
  statusAtTime: text("status_at_time"),
  source: text("source").notNull(), // 'import' | 'sheet_edit' | 'app_edit' | 'note'
  note: text("note"), // free-text status update / commentary at this point in time
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * `pendingSyncChanges` is the review queue for everything a sync pull can't
 * safely resolve on its own — nothing reaches the live Weekly Update.xlsx
 * without appearing here first and being approved. Three kinds share this
 * one table/UI:
 *  - 'outbound': app changed a field the sheet didn't touch. Approving
 *    queues newValue for the next push; oldValue is the last-synced value.
 *  - 'conflict': both sides changed the same field to different values.
 *    oldValue = last-synced value, newValue = the app's value, sheetValue =
 *    what's now in the sheet. Resolution decides which value wins (or a
 *    manually-typed replacement) — never auto-picked.
 *  - 'removed_from_sheet': the deal disappeared from the live sheet since
 *    the last sync (someone deleted the row). field/oldValue/newValue/
 *    sheetValue are unused; resolution records whether Joseph archived it
 *    or kept it live in the app regardless.
 */
export const pendingSyncChanges = pgTable("pending_sync_changes", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("outbound"), // outbound | conflict | removed_from_sheet
  field: text("field"), // null only for removed_from_sheet
  oldValue: text("old_value"),
  newValue: text("new_value"),
  sheetValue: text("sheet_value"), // conflicts only: the sheet's current value for this field
  resolution: text("resolution"), // conflicts: keep_app | keep_sheet | custom:<value>; removed_from_sheet: archive | keep
  status: text("status").notNull().default("pending"), // pending | approved | rejected | synced
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * `archiveDeals` is a straight, read-only import of the Archive_2025 sheet —
 * historical closed/lost deals, kept separate from the live tracker.
 */
export const archiveDeals = pgTable("archive_deals", {
  id: text("id").primaryKey(),
  dealName: text("deal_name").notNull(),
  sponsors: text("sponsors"),
  bank: text("bank"),
  ccy: text("ccy"),
  amountMM: text("amount_mm"),
  premium: text("premium"),
  dayCount: text("day_count"),
  tenorYears: text("tenor_years"),
  insuredPct: text("insured_pct"),
  closingOrDropDate: text("closing_or_drop_date"),
  outcome: text("outcome"), // Closed / Dropped / Rejected / Turned Down
  statusNote: text("status_note"),
  coveredBy: text("covered_by"),
});

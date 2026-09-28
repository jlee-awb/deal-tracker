// Column layout for the throwaway test fixture — deliberately mirrors the
// real Weekly Update.xlsx "Current" sheet's shape (a formula-bearing
// "Updated" flag in column A, an S/N row-counter formula in the last
// column, plain-input columns in between) without replicating its exact
// day-count lookup logic, which isn't relevant to testing the sync engine
// itself. Row 1 is headers; data starts at row 2.

import { SheetDealRow, SyncedField } from "../types";
export { slug } from "../../lib/slug";

export const HEADER_ROW = 1;
export const FIRST_DATA_ROW = 2;

// Column -> field for every column that holds a plain, syncable value.
// B (dealName) and D (bank) are identity fields: read here, but never part
// of SYNCED_FIELDS, since a "change" to either is a rename — handled as
// remove + add, not a field diff.
export const FIELD_COLUMNS: Record<string, keyof SheetDealRow> = {
  B: "dealName",
  C: "sponsors",
  D: "bank",
  E: "ccy",
  F: "amountMM",
  H: "premium",
  J: "tenorYears",
  K: "insuredPct",
  L: "latestCommDate",
  M: "statusUpdate",
  N: "nextStep",
  O: "underwritingStatus",
  P: "coveredBy",
  Q: "status",
};

export const SYNCED_FIELD_COLUMNS: Partial<Record<SyncedField, string>> = {
  sponsors: "C",
  ccy: "E",
  amountMM: "F",
  premium: "H",
  tenorYears: "J",
  insuredPct: "K",
  latestCommDate: "L",
  statusUpdate: "M",
  nextStep: "N",
  underwritingStatus: "O",
  coveredBy: "P",
  status: "Q",
};

// Formula columns the sync engine must NEVER write a plain value into.
// New rows get these regenerated (see formulasForRow below); existing rows
// keep whatever formula is already there, untouched.
export const FORMULA_COLUMNS = ["A", "I", "R"] as const;

export function formulasForRow(row: number): Record<string, string> {
  return {
    A: `=IF(L${row}="","",L${row})`, // stand-in for the real "Updated" flag
    R: `=ROW()-1`, // stand-in for the real S/N counter
  };
}

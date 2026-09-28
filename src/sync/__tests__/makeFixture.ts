// Builds a throwaway .xlsx fixture that mirrors the real Weekly Update.xlsx
// "Current" sheet's shape closely enough to test the sync engine safely:
// a header row, a formula-bearing "Updated" column (A) and S/N column (R),
// and plain-input columns in between. All deal names/banks are synthetic.

import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { FIELD_COLUMNS, formulasForRow, FIRST_DATA_ROW } from "../adapters/columns";

export interface FixtureRow {
  dealName: string;
  sponsors: string;
  bank: string;
  ccy: string;
  amountMM: string;
  premium: string;
  tenorYears: string;
  insuredPct: string;
  latestCommDate: string;
  statusUpdate: string;
  nextStep: string;
  underwritingStatus: string;
  coveredBy: string;
  status: string;
}

const HEADERS: Record<string, string> = {
  A: "Updated",
  B: "Deal Name",
  C: "Sponsor(s)",
  D: "Bank",
  E: "CCY",
  F: "Amount (MM)",
  H: "Premium",
  I: "Day Count",
  J: "Tenor (yrs)",
  K: "Insured %",
  L: "Latest Comm",
  M: "Status Update",
  N: "Next Step",
  O: "Underwriting Status",
  P: "Covered By",
  Q: "Status",
  R: "S/N",
};

export async function writeFixture(filePath: string, rows: FixtureRow[]) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Current");

  for (const [col, label] of Object.entries(HEADERS)) {
    sheet.getRow(1).getCell(col).value = label;
  }

  rows.forEach((deal, i) => {
    const rowNumber = FIRST_DATA_ROW + i;
    const row = sheet.getRow(rowNumber);
    for (const [col, field] of Object.entries(FIELD_COLUMNS)) {
      row.getCell(col).value = (deal as unknown as Record<string, string>)[field] ?? "";
    }
    // I (Day Count) is a formula on the real sheet too — give it a trivial
    // stand-in formula so it's exercised as "a formula column" the same as
    // A and R, even though it isn't in FORMULA_COLUMNS (not synced either
    // way, so the engine never touches it — this just checks realism).
    row.getCell("I").value = { formula: `IF(E${rowNumber}="","",E${rowNumber})` };
    const formulas = formulasForRow(rowNumber);
    for (const [col, formula] of Object.entries(formulas)) {
      row.getCell(col).value = { formula: formula.replace(/^=/, "") };
    }
    row.commit();
  });

  await workbook.xlsx.writeFile(filePath);
}

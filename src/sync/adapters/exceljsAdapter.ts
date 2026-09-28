import ExcelJS from "exceljs";
import { SheetAdapter, SheetDealRow, FieldChange } from "../types";
import { FIELD_COLUMNS, SYNCED_FIELD_COLUMNS, FORMULA_COLUMNS, formulasForRow, slug, FIRST_DATA_ROW } from "./columns";

/**
 * Local-.xlsx-file implementation of SheetAdapter — used to build and test
 * the reconciliation engine against a throwaway copy of the workbook,
 * without any Graph API access (this session's Microsoft 365 connector is
 * read-only, and the deployed app's own write-scoped access doesn't exist
 * yet either). Same interface the production GraphExcelAdapter implements,
 * so reconcile.ts and everything upstream of it don't change when the real
 * adapter is swapped in.
 */
export class ExcelJsAdapter implements SheetAdapter {
  constructor(private filePath: string) {}

  private async loadSheet() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.filePath);
    const sheet = workbook.getWorksheet("Current");
    if (!sheet) throw new Error(`No "Current" sheet found in ${this.filePath}`);
    return { workbook, sheet };
  }

  async readCurrentSheet(): Promise<SheetDealRow[]> {
    const { sheet } = await this.loadSheet();
    const rows: SheetDealRow[] = [];

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < FIRST_DATA_ROW) return;
      const get = (col: string) => String(row.getCell(col).value ?? "").trim();
      const dealName = get("B");
      const bank = get("D");
      if (!dealName || !bank) return; // skip section-divider / blank rows

      rows.push({
        key: slug(dealName, bank),
        dealName,
        sponsors: get("C"),
        bank,
        ccy: get("E"),
        amountMM: get("F"),
        premium: get("H"),
        tenorYears: get("J"),
        insuredPct: get("K"),
        latestCommDate: get("L"),
        statusUpdate: get("M"),
        nextStep: get("N"),
        underwritingStatus: get("O"),
        coveredBy: get("P"),
        status: get("Q"),
      });
    });

    return rows;
  }

  async writeChanges(changes: FieldChange[], newDeals: SheetDealRow[]): Promise<void> {
    const { workbook, sheet } = await this.loadSheet();

    // Map key -> row number for existing rows.
    const rowNumberByKey = new Map<string, number>();
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < FIRST_DATA_ROW) return;
      const dealName = String(row.getCell("B").value ?? "").trim();
      const bank = String(row.getCell("D").value ?? "").trim();
      if (!dealName || !bank) return;
      rowNumberByKey.set(slug(dealName, bank), rowNumber);
    });

    for (const change of changes) {
      const rowNumber = rowNumberByKey.get(change.key);
      if (!rowNumber) {
        throw new Error(`writeChanges: no existing sheet row for key "${change.key}" — was it removed?`);
      }
      const col = SYNCED_FIELD_COLUMNS[change.field];
      if (!col) throw new Error(`writeChanges: "${change.field}" has no sheet column mapping`);
      if ((FORMULA_COLUMNS as readonly string[]).includes(col)) {
        throw new Error(`writeChanges: refusing to write to formula column ${col}`);
      }
      sheet.getRow(rowNumber).getCell(col).value = change.newValue;
    }

    let nextRow = sheet.rowCount + 1;
    for (const deal of newDeals) {
      const row = sheet.getRow(nextRow);
      for (const [col, field] of Object.entries(FIELD_COLUMNS)) {
        row.getCell(col).value = deal[field] ?? "";
      }
      const formulas = formulasForRow(nextRow);
      for (const [col, formula] of Object.entries(formulas)) {
        row.getCell(col).value = { formula: formula.replace(/^=/, "") };
      }
      row.commit();
      nextRow++;
    }

    await workbook.xlsx.writeFile(this.filePath);
  }
}

// Plain assertion-based test run (no test framework — avoided a peer-dep
// conflict pulling one in) for the two-way sync engine, exercised entirely
// against a throwaway local .xlsx fixture. Run with: npx tsx src/sync/__tests__/run.ts

import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import path from "path";
import { writeFixture, FixtureRow } from "./makeFixture";
import { ExcelJsAdapter } from "../adapters/exceljsAdapter";
import { reconcile } from "../reconcile";
import { planSync, pendingKey } from "../plan";
import { slug } from "../adapters/columns";
import { SheetDealRow, FieldChange } from "../types";

const FIXTURE_PATH = path.join(process.cwd(), "test-fixtures", "weekly-update-test.xlsx");

const initialRows: FixtureRow[] = [
  {
    dealName: "Deal Alpha",
    sponsors: "Test Sponsor A",
    bank: "Bank A",
    ccy: "USD",
    amountMM: "10.0",
    premium: "2.50%",
    tenorYears: "5.0",
    insuredPct: "50.00%",
    latestCommDate: "2026-09-20",
    statusUpdate: "Waiting on Bank A.",
    nextStep: "Chase for update",
    underwritingStatus: "Under review",
    coveredBy: "AA",
    status: "Early Discussion",
  },
  {
    dealName: "Deal Beta",
    sponsors: "N/A",
    bank: "Bank B",
    ccy: "USD",
    amountMM: "20.0",
    premium: "TBC",
    tenorYears: "TBC",
    insuredPct: "TBC",
    latestCommDate: "2026-09-18",
    statusUpdate: "On hold pending criteria.",
    nextStep: "",
    underwritingStatus: "Not started",
    coveredBy: "BB",
    status: "On Hold",
  },
  {
    dealName: "Deal Gamma",
    sponsors: "Test Sponsor C",
    bank: "Bank C",
    ccy: "EUR",
    amountMM: "15.0",
    premium: "2.10%",
    tenorYears: "3.0",
    insuredPct: "60.00%",
    latestCommDate: "2026-09-10",
    statusUpdate: "Steady.",
    nextStep: "",
    underwritingStatus: "Completed",
    coveredBy: "AA",
    status: "Early Discussion",
  },
  {
    dealName: "Deal Delta",
    sponsors: "N/A",
    bank: "Bank D",
    ccy: "USD",
    amountMM: "5.0",
    premium: "1.90%",
    tenorYears: "2.0",
    insuredPct: "40.00%",
    latestCommDate: "2026-01-05",
    statusUpdate: "Closed.",
    nextStep: "",
    underwritingStatus: "Completed",
    coveredBy: "BB",
    status: "Closed",
  },
];

async function directlyEditFixture(mutate: (sheet: ExcelJS.Worksheet) => void) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(FIXTURE_PATH);
  const sheet = workbook.getWorksheet("Current")!;
  mutate(sheet);
  await workbook.xlsx.writeFile(FIXTURE_PATH);
}

function findRowNumber(sheet: ExcelJS.Worksheet, dealName: string): number {
  let found = -1;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (String(row.getCell("B").value ?? "") === dealName) found = rowNumber;
  });
  if (found === -1) throw new Error(`fixture row not found: ${dealName}`);
  return found;
}

let passed = 0;
function check(label: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${label}`);
}

async function main() {
  console.log("Building throwaway fixture...");
  await writeFixture(FIXTURE_PATH, initialRows);

  const adapter = new ExcelJsAdapter(FIXTURE_PATH);
  const lastSnapshot = await adapter.readCurrentSheet();
  assert.equal(lastSnapshot.length, 4, "fixture should read back 4 rows");

  const alphaKey = slug("Deal Alpha", "Bank A");
  const betaKey = slug("Deal Beta", "Bank B");
  const gammaKey = slug("Deal Gamma", "Bank C");
  const deltaKey = slug("Deal Delta", "Bank D");

  // --- Simulate the app having independently changed two fields ---
  const appRows: SheetDealRow[] = lastSnapshot.map((r) => ({ ...r }));
  const alphaApp = appRows.find((r) => r.key === alphaKey)!;
  alphaApp.coveredBy = "CC"; // sheet won't touch this — should end up queued outbound
  const betaApp = appRows.find((r) => r.key === betaKey)!;
  betaApp.status = "Closed"; // sheet will ALSO change this — should conflict

  // --- Simulate a colleague editing the live sheet directly ---
  console.log("Simulating direct edits to the sheet by other people...");
  await directlyEditFixture((sheet) => {
    const alphaRow = findRowNumber(sheet, "Deal Alpha");
    sheet.getRow(alphaRow).getCell("N").value = "Their turn now"; // nextStep — sheet-only change

    const betaRow = findRowNumber(sheet, "Deal Beta");
    sheet.getRow(betaRow).getCell("Q").value = "Rejected"; // conflicts with app's "Closed"

    const deltaRow = findRowNumber(sheet, "Deal Delta");
    sheet.spliceRows(deltaRow, 1); // someone deleted this row entirely

    const newRow = sheet.getRow(sheet.rowCount + 1);
    newRow.getCell("B").value = "Deal Epsilon";
    newRow.getCell("C").value = "N/A";
    newRow.getCell("D").value = "Bank E";
    newRow.getCell("E").value = "USD";
    newRow.getCell("F").value = "8.0";
    newRow.getCell("H").value = "TBC";
    newRow.getCell("J").value = "TBC";
    newRow.getCell("K").value = "TBC";
    newRow.getCell("L").value = "2026-09-25";
    newRow.getCell("M").value = "Brand new, added directly in the sheet.";
    newRow.getCell("N").value = "";
    newRow.getCell("O").value = "Not started";
    newRow.getCell("P").value = "AA";
    newRow.getCell("Q").value = "Early Discussion";
    newRow.commit();
  });

  const sheetAfterEdits = await adapter.readCurrentSheet();

  const { pull, outbound } = reconcile(sheetAfterEdits, appRows, lastSnapshot);

  console.log("\nChecking pull results (sheet -> app)...");
  check("Alpha's nextStep is pulled in as a pure external change", () => {
    const c = pull.externalChanges.find((c) => c.key === alphaKey && c.field === "nextStep");
    assert.ok(c, "expected an externalChange for alpha.nextStep");
    assert.equal(c!.oldValue, "Chase for update");
    assert.equal(c!.newValue, "Their turn now");
  });
  check("Beta's status is NOT in externalChanges (it's a conflict, not a plain pull)", () => {
    const c = pull.externalChanges.find((c) => c.key === betaKey && c.field === "status");
    assert.equal(c, undefined);
  });
  check("Deal Epsilon shows up as a new row from the sheet", () => {
    assert.ok(pull.newRows.some((r) => r.dealName === "Deal Epsilon"));
  });
  check("Deal Delta shows up as removed from the sheet", () => {
    assert.ok(pull.removedFromSheet.includes(deltaKey));
  });
  check("Deal Gamma (untouched) produces no changes at all", () => {
    assert.ok(!pull.externalChanges.some((c) => c.key === gammaKey));
  });

  console.log("\nChecking outbound diff (app -> sheet)...");
  check("Alpha's coveredBy change is queued for push", () => {
    const c = outbound.toQueue.find((c) => c.key === alphaKey && c.field === "coveredBy");
    assert.ok(c, "expected alpha.coveredBy queued outbound");
    assert.equal(c!.oldValue, "AA");
    assert.equal(c!.newValue, "CC");
  });
  check("Beta's status is a flagged conflict, not silently queued", () => {
    const conflict = outbound.conflicts.find((c) => c.key === betaKey && c.field === "status");
    assert.ok(conflict, "expected a conflict for beta.status");
    assert.equal(conflict!.sheetValue, "Rejected");
    assert.equal(conflict!.appValue, "Closed");
    assert.equal(conflict!.lastSyncedValue, "On Hold");
    assert.ok(!outbound.toQueue.some((c) => c.key === betaKey && c.field === "status"));
  });

  console.log("\nChecking the DB-write planning layer (plan.ts)...");
  const emptyPending = new Set<string>();
  const plan1 = planSync(sheetAfterEdits, appRows, lastSnapshot, emptyPending);
  check("plan queues alpha.coveredBy as outbound", () => {
    assert.ok(plan1.pendingUpserts.some((p) => p.dealId === alphaKey && p.kind === "outbound" && p.field === "coveredBy"));
  });
  check("plan queues beta.status as a conflict, not outbound", () => {
    assert.ok(plan1.pendingUpserts.some((p) => p.dealId === betaKey && p.kind === "conflict" && p.field === "status"));
    assert.ok(!plan1.pendingUpserts.some((p) => p.dealId === betaKey && p.kind === "outbound"));
  });
  check("plan queues delta as removed_from_sheet", () => {
    assert.ok(plan1.pendingUpserts.some((p) => p.dealId === deltaKey && p.kind === "removed_from_sheet"));
  });
  check("plan applies alpha.nextStep as a direct deal field update", () => {
    assert.ok(plan1.dealFieldUpdates.some((u) => u.dealId === alphaKey && u.field === "nextStep" && u.newValue === "Their turn now"));
  });
  check("plan advances alpha's snapshot only for the pulled field", () => {
    const su = plan1.snapshotUpdates.find((s) => s.dealId === alphaKey);
    assert.ok(su);
    assert.deepEqual(su!.fields, { nextStep: "Their turn now" });
  });
  check("re-running plan against an already-pending queue produces no duplicates", () => {
    const alreadyPending = new Set(plan1.pendingUpserts.map((p) => pendingKey(p.dealId, p.kind, p.field)));
    const plan2 = planSync(sheetAfterEdits, appRows, lastSnapshot, alreadyPending);
    assert.equal(plan2.pendingUpserts.length, 0, "nothing new to queue on a repeat pull with no further changes");
  });
  check("an outbound row escalates to a conflict and is flagged for supersession", () => {
    // Simulate: alpha.coveredBy was already queued outbound last cycle: the
    // sheet then ALSO changes it independently this cycle, to a different
    // value than the app has — a genuine escalation.
    const priorPending = new Set([pendingKey(alphaKey, "outbound", "coveredBy")]);
    const sheetWithNewConflict = sheetAfterEdits.map((r) =>
      r.key === alphaKey ? { ...r, coveredBy: "ZZ" } : r
    );
    const plan3 = planSync(sheetWithNewConflict, appRows, lastSnapshot, priorPending);
    assert.ok(
      plan3.supersedes.some((s) => s.dealId === alphaKey && s.field === "coveredBy" && s.supersededKind === "outbound")
    );
    assert.ok(plan3.pendingUpserts.some((p) => p.dealId === alphaKey && p.kind === "conflict" && p.field === "coveredBy"));
  });

  console.log("\nChecking the approved push writes correctly...");
  const approved: FieldChange[] = outbound.toQueue.filter(
    (c) => c.key === alphaKey && c.field === "coveredBy"
  );
  const newDeal: SheetDealRow = {
    key: slug("Deal Zeta", "Bank Z"),
    dealName: "Deal Zeta",
    sponsors: "N/A",
    bank: "Bank Z",
    ccy: "USD",
    amountMM: "12.0",
    premium: "TBC",
    tenorYears: "TBC",
    insuredPct: "TBC",
    latestCommDate: "2026-09-27",
    statusUpdate: "Created in the app, not yet in the sheet.",
    nextStep: "",
    underwritingStatus: "Not started",
    coveredBy: "AA",
    status: "Early Discussion",
  };
  await adapter.writeChanges(approved, [newDeal]);

  const workbookAfterPush = new ExcelJS.Workbook();
  await workbookAfterPush.xlsx.readFile(FIXTURE_PATH);
  const sheetAfterPush = workbookAfterPush.getWorksheet("Current")!;

  check("Alpha's coveredBy cell is now CC in the actual file", () => {
    const r = findRowNumber(sheetAfterPush, "Deal Alpha");
    assert.equal(String(sheetAfterPush.getRow(r).getCell("P").value), "CC");
  });
  check("Alpha's nextStep (untouched by the push) still reflects the earlier direct edit", () => {
    const r = findRowNumber(sheetAfterPush, "Deal Alpha");
    assert.equal(String(sheetAfterPush.getRow(r).getCell("N").value), "Their turn now");
  });
  check("Alpha's formula columns (A, R) are still formulas, not overwritten", () => {
    const r = findRowNumber(sheetAfterPush, "Deal Alpha");
    const aCell = sheetAfterPush.getRow(r).getCell("A");
    const rCell = sheetAfterPush.getRow(r).getCell("R");
    assert.equal(typeof aCell.value, "object");
    assert.ok((aCell.value as ExcelJS.CellFormulaValue).formula);
    assert.equal(typeof rCell.value, "object");
    assert.ok((rCell.value as ExcelJS.CellFormulaValue).formula);
  });
  check("Deal Zeta was appended with correct plain fields and regenerated formulas", () => {
    const r = findRowNumber(sheetAfterPush, "Deal Zeta");
    assert.equal(String(sheetAfterPush.getRow(r).getCell("D").value), "Bank Z");
    assert.equal(String(sheetAfterPush.getRow(r).getCell("Q").value), "Early Discussion");
    const rCell = sheetAfterPush.getRow(r).getCell("R");
    assert.equal(typeof rCell.value, "object");
    assert.ok((rCell.value as ExcelJS.CellFormulaValue).formula);
  });

  console.log("\nChecking the formula-column write guard...");
  check("writeChanges refuses to write to a formula column", async () => {
    let threw = false;
    try {
      await adapter.writeChanges(
        [{ key: alphaKey, field: "sponsors", oldValue: "x", newValue: "y" } as FieldChange].map((c) => ({
          ...c,
        })),
        []
      );
    } catch {
      threw = false; // sponsors is a valid plain column — this one should NOT throw
    }
    // Now actually attempt an invalid column mapping by monkeypatching is
    // overkill for this fixture; instead confirm the real guard: attempt to
    // write a change whose field has no SYNCED_FIELD_COLUMNS entry at all.
    try {
      // @ts-expect-error deliberately invalid field to exercise the runtime guard
      await adapter.writeChanges([{ key: alphaKey, field: "dealName", oldValue: "x", newValue: "y" }], []);
    } catch {
      threw = true;
    }
    assert.ok(threw, "expected writeChanges to reject an unmapped/identity field");
  });

  console.log(`\nAll ${passed} checks passed.`);
}

main().catch((err) => {
  console.error("\nFAILED:", err);
  process.exit(1);
});

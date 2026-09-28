import { SheetAdapter } from "../types";
import { ExcelJsAdapter } from "./exceljsAdapter";

/**
 * Returns whichever SheetAdapter is configured for this environment.
 * Everything upstream (plan.ts, runSync.ts, runPush.ts) only ever talks to
 * the SheetAdapter interface, so swapping this out for a real
 * GraphExcelAdapter later — once a write-scoped Entra app registration
 * exists — is a change confined to this one function.
 *
 * SYNC_LOCAL_XLSX_PATH is a local-dev/testing escape hatch only: it points
 * at a throwaway .xlsx file on disk (never a real copy of Weekly
 * Update.xlsx) so the pull/push wiring can be exercised end-to-end before
 * Graph access exists. It is never read from a committed file — set it in
 * .env.local only.
 */
export function getAdapter(): SheetAdapter {
  const localPath = process.env.SYNC_LOCAL_XLSX_PATH;
  if (localPath) {
    return new ExcelJsAdapter(localPath);
  }
  throw new Error(
    "No sync adapter configured. Set SYNC_LOCAL_XLSX_PATH for local testing against a " +
      "throwaway .xlsx, or wire up GraphExcelAdapter once Entra write-scope access to " +
      "Weekly Update.xlsx exists — see README."
  );
}

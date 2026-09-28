import Link from "next/link";
import { getPendingSyncQueue } from "@/lib/queries";
import {
  pullAction,
  pushAction,
  approveOutboundAction,
  rejectOutboundAction,
  resolveConflictKeepAppAction,
  resolveConflictKeepSheetAction,
  resolveConflictCustomAction,
  acknowledgeRemovedAction,
} from "./actions";
import type { SyncedField } from "@/sync/types";

// Live review-queue state — never bake this into the static build output.
export const dynamic = "force-dynamic";

const FIELD_LABELS: Record<SyncedField, string> = {
  sponsors: "Sponsor(s)",
  ccy: "CCY",
  amountMM: "Amount (MM)",
  premium: "Premium",
  tenorYears: "Tenor (yrs)",
  insuredPct: "Insured %",
  latestCommDate: "Latest Comm",
  statusUpdate: "Status Update",
  nextStep: "Next Step",
  underwritingStatus: "Underwriting Status",
  coveredBy: "Covered By",
  status: "Status",
};

function fieldLabel(field: string | null): string {
  if (!field) return "—";
  return FIELD_LABELS[field as SyncedField] ?? field;
}

export default async function SyncPage() {
  const { conflicts, outbound, removed } = await getPendingSyncQueue();
  const isEmpty = conflicts.length === 0 && outbound.length === 0 && removed.length === 0;
  const approvedCount = outbound.filter((r) => r.status === "approved").length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Sync review queue</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Nothing reaches Weekly Update.xlsx without being approved here first.
          </p>
        </div>
        <Link href="/" className="shrink-0 text-sm text-neutral-500 hover:text-neutral-900">
          ← Dashboard
        </Link>
      </header>

      <div className="mb-8 flex flex-wrap gap-3">
        <form action={pullAction}>
          <button
            type="submit"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Run sync now
          </button>
        </form>
        <form action={pushAction}>
          <button
            type="submit"
            disabled={approvedCount === 0}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            Push approved changes{approvedCount > 0 ? ` (${approvedCount})` : ""}
          </button>
        </form>
      </div>

      {isEmpty && (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
          Nothing waiting on a decision. Run sync to pull the latest from the spreadsheet.
        </p>
      )}

      {conflicts.length > 0 && (
        <Section title="Conflicts" hint="Both sides changed the same field. Pick a value — nothing is guessed.">
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {conflicts.map((row) => (
              <li key={row.id} className="px-4 py-4">
                <RowHeader deal={row.deal} field={row.field} />
                <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <ValueBox label="Your app" value={row.newValue} />
                  <ValueBox label="Spreadsheet" value={row.sheetValue} />
                </div>
                {row.status === "approved" ? (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    Resolved — queued to push ({row.resolution?.startsWith("custom:") ? "custom value" : "kept app value"}).
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <form action={resolveConflictKeepAppAction.bind(null, row.id)}>
                      <ActionButton>Keep app value</ActionButton>
                    </form>
                    <form action={resolveConflictKeepSheetAction.bind(null, row.id)}>
                      <ActionButton>Keep spreadsheet value</ActionButton>
                    </form>
                    <form action={resolveConflictCustomAction.bind(null, row.id)} className="flex items-center gap-1.5">
                      <input
                        name="customValue"
                        placeholder="Custom value"
                        className="w-36 rounded-md border border-neutral-300 px-2 py-1 text-xs"
                      />
                      <ActionButton>Use this</ActionButton>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {outbound.length > 0 && (
        <Section title="Outbound changes" hint="Changed in your app; the spreadsheet hasn't touched these fields.">
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {outbound.map((row) => (
              <li key={row.id} className="px-4 py-4">
                <RowHeader deal={row.deal} field={row.field} />
                <div className="mt-2 text-sm">
                  <ValueBox label={`New value${row.oldValue ? " (was: " + row.oldValue + ")" : ""}`} value={row.newValue} />
                </div>
                {row.status === "approved" ? (
                  <p className="mt-2 text-xs font-medium text-emerald-700">Approved — queued to push.</p>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <form action={approveOutboundAction.bind(null, row.id)}>
                      <ActionButton>Approve</ActionButton>
                    </form>
                    <form action={rejectOutboundAction.bind(null, row.id)}>
                      <ActionButton variant="muted">Reject</ActionButton>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {removed.length > 0 && (
        <Section title="Removed from the sheet" hint="These deals disappeared from Weekly Update.xlsx since the last sync.">
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {removed.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 px-4 py-4">
                <RowHeader deal={row.deal} field={null} />
                <form action={acknowledgeRemovedAction.bind(null, row.id)}>
                  <ActionButton variant="muted">Acknowledge</ActionButton>
                </form>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </main>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-medium text-neutral-700">{title}</h2>
      <p className="mb-3 text-xs text-neutral-400">{hint}</p>
      {children}
    </section>
  );
}

function RowHeader({ deal, field }: { deal: { dealName: string; bank: string } | null; field: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="truncate font-medium text-neutral-900">{deal ? deal.dealName : "(deal not found)"}</span>
      <span className="shrink-0 text-xs text-neutral-500">
        {deal?.bank} {field ? `· ${fieldLabel(field)}` : ""}
      </span>
    </div>
  );
}

function ValueBox({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-md border border-neutral-200 px-3 py-2">
      <div className="text-[11px] text-neutral-400">{label}</div>
      <div className="text-neutral-900">{value || "(blank)"}</div>
    </div>
  );
}

function ActionButton({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "muted";
}) {
  return (
    <button
      type="submit"
      className={
        variant === "default"
          ? "rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-700"
          : "rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
      }
    >
      {children}
    </button>
  );
}

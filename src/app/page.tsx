import Link from "next/link";
import { getKpiCounts, getDealsGroupedByStatus, isRecent } from "@/lib/queries";

const STATUS_ORDER = [
  "Early Discussion",
  "On Hold",
  "Closed",
  "Dropped",
  "Turned Down",
  "Rejected",
] as const;

const STATUS_STYLES: Record<string, string> = {
  "Early Discussion": "bg-blue-50 text-blue-700 border-blue-200",
  "On Hold": "bg-amber-50 text-amber-700 border-amber-200",
  Closed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Dropped: "bg-neutral-100 text-neutral-600 border-neutral-200",
  "Turned Down": "bg-neutral-100 text-neutral-600 border-neutral-200",
  Rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

export default async function DashboardPage() {
  const [kpis, groups] = await Promise.all([getKpiCounts(), getDealsGroupedByStatus()]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-xl font-semibold text-neutral-900">Deal Tracker</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Synthetic demo data — mirrors the Weekly Update.xlsx pipeline structure, no real deals.
        </p>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="In Pipeline" value={kpis.inPipeline} />
        <Kpi label="On Hold" value={kpis.onHold} />
        <Kpi label="Closed" value={kpis.closed} />
        <Kpi label="Total Declines" value={kpis.totalDeclines} sub={`${kpis.dropped} dropped · ${kpis.turnedDown} turned down · ${kpis.rejected} rejected`} />
      </div>

      <div className="space-y-8">
        {STATUS_ORDER.filter((s) => groups[s]?.length).map((status) => (
          <section key={status}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-700">
              {status}
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                {groups[status].length}
              </span>
            </h2>
            <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
              {groups[status].map((deal) => (
                <li key={deal.id}>
                  <Link
                    href={`/deals/${deal.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-neutral-50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-neutral-900">{deal.dealName}</span>
                        {isRecent(deal.latestCommDate) && (
                          <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                            Updated
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm text-neutral-500">
                        {deal.bank} · {deal.ccy} {deal.amountMM}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[deal.status] ?? ""}`}
                    >
                      {deal.coveredBy}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 px-4 py-3">
      <div className="text-2xl font-semibold text-neutral-900">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
      {sub && <div className="mt-1 text-[11px] text-neutral-400">{sub}</div>}
    </div>
  );
}

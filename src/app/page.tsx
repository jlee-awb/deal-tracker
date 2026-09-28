import Link from "next/link";
import { getKpiCounts, getDealsGroupedByStatus, isRecent } from "@/lib/queries";
import { LIVE_STATUSES, CLOSED_STATUSES, DEAD_STATUSES, DEAD_STATUS_DEFINITIONS } from "@/lib/dealTaxonomy";
import { signOut } from "@/auth";

// Live pipeline data — never bake this into the static build output.
export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  "Early Discussion": "bg-blue-50 text-blue-700 border-blue-200",
  "On Hold": "bg-amber-50 text-amber-700 border-amber-200",
  Closed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Dropped: "bg-neutral-100 text-neutral-600 border-neutral-200",
  "Turned Down": "bg-orange-50 text-orange-700 border-orange-200",
  Rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

// Distinct bar colors for the decline-reason breakdown — kept separate from
// STATUS_STYLES above since a legible three-way split needs more contrast
// than the badge palette does.
const DEAD_BAR_COLORS: Record<string, string> = {
  Dropped: "bg-neutral-400",
  "Turned Down": "bg-orange-400",
  Rejected: "bg-rose-500",
};

const BUCKETS: { title: "Live" | "Closed" | "Dead / Declined"; statuses: readonly string[] }[] = [
  { title: "Live", statuses: LIVE_STATUSES },
  { title: "Closed", statuses: CLOSED_STATUSES },
  { title: "Dead / Declined", statuses: DEAD_STATUSES },
];

export default async function DashboardPage() {
  const [kpis, groups] = await Promise.all([getKpiCounts(), getDealsGroupedByStatus()]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Deal Tracker</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Synthetic demo data — mirrors the Weekly Update.xlsx pipeline structure, no real deals.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <Link href="/sync" className="text-sm text-neutral-500 hover:text-neutral-900">
            Sync queue →
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="text-sm text-neutral-400 hover:text-neutral-700">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Live" value={kpis.inPipeline} />
        <Kpi label="Closed" value={kpis.closed} />
        <Kpi label="Dead / Declined" value={kpis.totalDeclines} />
        <Kpi label="Total shown" value={kpis.total} sub="All deals ever entered" />
      </div>

      <DeclineBreakdown kpis={kpis} />

      <div className="space-y-10">
        {BUCKETS.map((bucket) => {
          const statusesWithDeals = bucket.statuses.filter((s) => groups[s]?.length);
          if (statusesWithDeals.length === 0) return null;
          return (
            <div key={bucket.title}>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {bucket.title}
              </h2>
              <div className="space-y-8">
                {statusesWithDeals.map((status) => (
                  <section key={status}>
                    <h3 className="mb-1 flex items-center gap-2 text-sm font-medium text-neutral-700">
                      {status}
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                        {groups[status].length}
                      </span>
                    </h3>
                    {DEAD_STATUS_DEFINITIONS[status as keyof typeof DEAD_STATUS_DEFINITIONS] && (
                      <p className="mb-3 text-xs text-neutral-400">
                        {DEAD_STATUS_DEFINITIONS[status as keyof typeof DEAD_STATUS_DEFINITIONS]}
                      </p>
                    )}
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
            </div>
          );
        })}
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

function DeclineBreakdown({
  kpis,
}: {
  kpis: { total: number; totalDeclines: number; dropped: number; turnedDown: number; rejected: number };
}) {
  if (kpis.total === 0) return null;

  const declinePct = kpis.total > 0 ? Math.round((kpis.totalDeclines / kpis.total) * 100) : 0;
  const segments: { label: string; count: number }[] = [
    { label: "Dropped", count: kpis.dropped },
    { label: "Turned Down", count: kpis.turnedDown },
    { label: "Rejected", count: kpis.rejected },
  ];

  return (
    <div className="mb-8 rounded-lg border border-neutral-200 px-4 py-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-neutral-700">Dead / declined, by reason</h2>
        <p className="text-xs text-neutral-400">
          {kpis.totalDeclines} of {kpis.total} deals shown ({declinePct}%)
        </p>
      </div>

      {kpis.totalDeclines === 0 ? (
        <p className="text-xs text-neutral-400">No dead or declined deals yet.</p>
      ) : (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-100">
            {segments
              .filter((s) => s.count > 0)
              .map((s) => (
                <div
                  key={s.label}
                  className={DEAD_BAR_COLORS[s.label]}
                  style={{ width: `${(s.count / kpis.totalDeclines) * 100}%` }}
                  title={`${s.label}: ${s.count}`}
                />
              ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-500">
            {segments.map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${DEAD_BAR_COLORS[s.label]}`} />
                <span>
                  {s.label} — {s.count}
                  {kpis.totalDeclines > 0 ? ` (${Math.round((s.count / kpis.totalDeclines) * 100)}%)` : ""}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

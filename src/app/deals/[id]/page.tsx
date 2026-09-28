import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeal } from "@/lib/queries";

const FIELD_ROWS: { label: string; key: keyof NonNullable<Awaited<ReturnType<typeof getDeal>>>["deal"] }[] = [
  { label: "Sponsor(s)", key: "sponsors" },
  { label: "Bank", key: "bank" },
  { label: "Currency", key: "ccy" },
  { label: "Amount (MM)", key: "amountMM" },
  { label: "USD eqv. (MM)", key: "usdEqvMM" },
  { label: "Premium", key: "premium" },
  { label: "Day Count", key: "dayCount" },
  { label: "Policy Tenor (yrs)", key: "tenorYears" },
  { label: "Insured %", key: "insuredPct" },
  { label: "Underwriting Status", key: "underwritingStatus" },
  { label: "Covered By", key: "coveredBy" },
];

export default async function DealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ u?: string }>;
}) {
  const { id } = await params;
  const { u } = await searchParams;
  const result = await getDeal(id);
  if (!result) notFound();
  const { deal, updates } = result;

  // Timeline navigation: `u` is the index into the update log, newest last.
  // Default to the most recent entry.
  const index = u ? Math.min(Math.max(parseInt(u, 10) || 0, 0), updates.length - 1) : updates.length - 1;
  const current = updates[index];
  const hasPrev = index > 0;
  const hasNext = index < updates.length - 1;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-700">
        ← Pipeline
      </Link>

      <header className="mt-3 mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">{deal.dealName}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {deal.status} · Next step: {deal.nextStep || "—"}
        </p>
      </header>

      <section className="mb-8 rounded-lg border border-neutral-200">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm sm:grid-cols-3">
          {FIELD_ROWS.map(({ label, key }) => (
            <div key={String(key)}>
              <dt className="text-neutral-400">{label}</dt>
              <dd className="text-neutral-900">{String(deal[key] ?? "—") || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-700">
            Updates ({updates.length}) — chronological
          </h2>
          <div className="flex gap-2">
            <Link
              href={`/deals/${id}?u=${index - 1}`}
              aria-disabled={!hasPrev}
              className={`rounded border px-2 py-1 text-xs ${
                hasPrev
                  ? "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                  : "pointer-events-none border-neutral-100 text-neutral-300"
              }`}
            >
              ← Earlier
            </Link>
            <Link
              href={`/deals/${id}?u=${index + 1}`}
              aria-disabled={!hasNext}
              className={`rounded border px-2 py-1 text-xs ${
                hasNext
                  ? "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                  : "pointer-events-none border-neutral-100 text-neutral-300"
              }`}
            >
              Later →
            </Link>
          </div>
        </div>

        {current && (
          <div className="rounded-lg border border-neutral-200 p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-neutral-400">
              <span>{current.occurredAt}</span>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5">{sourceLabel(current.source)}</span>
            </div>
            {current.field ? (
              <p className="text-sm text-neutral-900">
                <span className="font-medium">{current.field}</span> changed from{" "}
                <span className="text-neutral-500">“{current.oldValue}”</span> to “{current.newValue}”
              </p>
            ) : (
              <p className="whitespace-pre-wrap text-sm text-neutral-900">{current.note}</p>
            )}
            {current.statusAtTime && (
              <p className="mt-2 text-xs text-neutral-400">Status at the time: {current.statusAtTime}</p>
            )}
          </div>
        )}

        <ol className="mt-4 space-y-1 border-l border-neutral-200 pl-4 text-xs text-neutral-400">
          {updates.map((upd, i) => (
            <li key={upd.id}>
              <Link
                href={`/deals/${id}?u=${i}`}
                className={i === index ? "font-medium text-neutral-900" : "hover:text-neutral-600"}
              >
                {upd.occurredAt} — {upd.field ?? "note"}
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function sourceLabel(source: string) {
  switch (source) {
    case "import":
      return "Imported";
    case "sheet_edit":
      return "Edited in Weekly Update.xlsx";
    case "app_edit":
      return "Edited here";
    default:
      return source;
  }
}

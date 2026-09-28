import { db } from "@/db/client";
import { deals, dealDetails, dealUpdates, archiveDeals, pendingSyncChanges } from "@/db/schema";
import { eq, asc, desc, inArray } from "drizzle-orm";
import { LIVE_STATUSES } from "@/lib/dealTaxonomy";

export async function getKpiCounts() {
  const all = await db.select().from(deals);
  const inPipeline = all.filter((d) => (LIVE_STATUSES as readonly string[]).includes(d.status)).length;
  const onHold = all.filter((d) => d.status === "On Hold").length;
  const closed = all.filter((d) => d.status === "Closed").length;
  const dropped = all.filter((d) => d.status === "Dropped").length;
  const turnedDown = all.filter((d) => d.status === "Turned Down").length;
  const rejected = all.filter((d) => d.status === "Rejected").length;
  return {
    total: all.length,
    inPipeline,
    onHold,
    closed,
    dropped,
    turnedDown,
    rejected,
    totalDeclines: dropped + turnedDown + rejected,
  };
}

export async function getDealsGroupedByStatus() {
  const all = await db.select().from(deals).orderBy(desc(deals.latestCommDate));
  const groups: Record<string, typeof all> = {};
  for (const d of all) {
    (groups[d.status] ??= []).push(d);
  }
  return groups;
}

export async function getDeal(id: string) {
  const [deal] = await db.select().from(deals).where(eq(deals.id, id));
  if (!deal) return null;
  const [details] = await db.select().from(dealDetails).where(eq(dealDetails.dealId, id));
  const updates = await db
    .select()
    .from(dealUpdates)
    .where(eq(dealUpdates.dealId, id))
    .orderBy(asc(dealUpdates.occurredAt), asc(dealUpdates.createdAt));
  return { deal, details: details ?? null, updates };
}

export async function getArchiveDeals() {
  return db.select().from(archiveDeals).orderBy(desc(archiveDeals.closingOrDropDate));
}

/** Everything in the review queue, grouped by kind, each row carrying the
 * deal's name/bank so the page doesn't need a second lookup per row. */
export async function getPendingSyncQueue() {
  const rows = await db
    .select()
    .from(pendingSyncChanges)
    .where(inArray(pendingSyncChanges.status, ["pending", "approved"]))
    .orderBy(asc(pendingSyncChanges.createdAt));

  const dealIds = Array.from(new Set(rows.map((r) => r.dealId)));
  const dealRows = dealIds.length ? await db.select().from(deals).where(inArray(deals.id, dealIds)) : [];
  const dealById = new Map(dealRows.map((d) => [d.id, d]));

  const withDeal = rows.map((r) => ({ ...r, deal: dealById.get(r.dealId) ?? null }));

  return {
    conflicts: withDeal.filter((r) => r.kind === "conflict"),
    outbound: withDeal.filter((r) => r.kind === "outbound"),
    removed: withDeal.filter((r) => r.kind === "removed_from_sheet"),
  };
}

export function isRecent(dateStr: string | null, days = 7) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return d >= cutoff;
}

import { db } from "@/db/client";
import { deals, dealDetails, dealUpdates, archiveDeals } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";

// Status groups, in the same order as the Weekly Update.xlsx "Current" sheet
// and the counts on its "Notes" sheet.
export const PIPELINE_STATUSES = ["Early Discussion", "On Hold"] as const;
export const CLOSED_STATUSES = ["Closed"] as const;
export const DECLINE_STATUSES = ["Dropped", "Turned Down", "Rejected"] as const;

export async function getKpiCounts() {
  const all = await db.select().from(deals);
  const inPipeline = all.filter((d) => (PIPELINE_STATUSES as readonly string[]).includes(d.status)).length;
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

export function isRecent(dateStr: string | null, days = 7) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return d >= cutoff;
}

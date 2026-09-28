// Synthetic seed data ONLY. Shaped identically to Weekly Update.xlsx's
// "Current" and "Archive_2025" sheets (same columns, same status vocabulary)
// but every deal name, sponsor, bank and figure below is invented — nothing
// here is real Awbury deal data. Swap this for the real sync once the
// two-way reconciliation engine (phase 4) is built and IT/Compliance has
// cleared hosting.

import { db } from "./client";
import { deals, dealDetails, dealUpdates, archiveDeals } from "./schema";
import { randomUUID } from "crypto";

function slug(dealName: string, bank: string) {
  return `${dealName}__${bank}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

type SeedDeal = {
  dealName: string;
  sponsors: string;
  bank: string;
  ccy: string;
  amountMM: string;
  usdEqvMM: number | null;
  premium: string;
  dayCount: string;
  tenorYears: string;
  insuredPct: string;
  latestCommDate: string;
  statusUpdate: string;
  nextStep: string;
  underwritingStatus: string;
  coveredBy: string;
  status: string;
};

const seedDeals: SeedDeal[] = [
  {
    dealName: "Project Harbor (Meridian Logistics)",
    sponsors: "Northlight Capital",
    bank: "Test Bank A APAC",
    ccy: "USD",
    amountMM: "25.0",
    usdEqvMM: 25.0,
    premium: "2.40%",
    dayCount: "ACT/360",
    tenorYears: "5.0",
    insuredPct: "60.00%",
    latestCommDate: "2026-09-24",
    statusUpdate: "Waiting on Test Bank A to confirm markups to the non-reliance letter.",
    nextStep: "Chase Test Bank A for a redline turnaround date.",
    underwritingStatus: "Under review",
    coveredBy: "AA",
    status: "Early Discussion",
  },
  {
    dealName: "Project Compass (Aurora Health)",
    sponsors: "N/A",
    bank: "Test Bank B Singapore",
    ccy: "USD",
    amountMM: "40.0",
    usdEqvMM: 40.0,
    premium: "2.10%",
    dayCount: "ACT/360",
    tenorYears: "1.5",
    insuredPct: "50.00%",
    latestCommDate: "2026-09-21",
    statusUpdate: "Test Bank B offered 210bps vs. their requested 180bps.",
    nextStep: "Awaiting counter from Test Bank B.",
    underwritingStatus: "Completed",
    coveredBy: "BB",
    status: "Early Discussion",
  },
  {
    dealName: "Fund Backstop Facility (NAV)",
    sponsors: "N/A",
    bank: "Test Bank C HK",
    ccy: "USD",
    amountMM: "TBC",
    usdEqvMM: null,
    premium: "TBC",
    dayCount: "ACT/360",
    tenorYears: "TBC",
    insuredPct: "TBC",
    latestCommDate: "2026-09-17",
    statusUpdate: "Test Bank C waiting to hear back from their internal credit committee.",
    nextStep: "Follow up in one week if no update.",
    underwritingStatus: "Not started",
    coveredBy: "AA",
    status: "Early Discussion",
  },
  {
    dealName: "Receivables Program II",
    sponsors: "N/A",
    bank: "Test Bank D APAC",
    ccy: "USD",
    amountMM: "100.0",
    usdEqvMM: 100.0,
    premium: "TBC",
    dayCount: "ACT/360",
    tenorYears: "TBC",
    insuredPct: "100.00%",
    latestCommDate: "2026-09-22",
    statusUpdate: "Test Bank D discussing internally about counterparty limits under the new treaty.",
    nextStep: "",
    underwritingStatus: "N/A",
    coveredBy: "AA",
    status: "Early Discussion",
  },
  {
    dealName: "Bridge Financing Alternatives",
    sponsors: "N/A",
    bank: "Test Bank E Bank",
    ccy: "USD",
    amountMM: "TBC",
    usdEqvMM: null,
    premium: "TBC",
    dayCount: "ACT/360",
    tenorYears: "TBC",
    insuredPct: "TBC",
    latestCommDate: "2026-09-07",
    statusUpdate: "Two shortlisted loans shared for full insured funding; obligor criteria under discussion.",
    nextStep: "Source and revert with loans meeting the agreed criteria.",
    underwritingStatus: "Not started",
    coveredBy: "BB",
    status: "On Hold",
  },
  {
    dealName: "Subscription Sales Portfolio",
    sponsors: "N/A",
    bank: "Test Corp (via Broker X)",
    ccy: "KRW",
    amountMM: "> USD 100MM eqv.",
    usdEqvMM: 100.0,
    premium: "TBC",
    dayCount: "ACT/365",
    tenorYears: "2.0",
    insuredPct: "TBC",
    latestCommDate: "2026-09-14",
    statusUpdate: "5% attachment proposed at 1% premium.",
    nextStep: "",
    underwritingStatus: "Ongoing",
    coveredBy: "CC / DD",
    status: "On Hold",
  },
  {
    dealName: "Project Illiad Test (Refi)",
    sponsors: "Test Sponsor Partners",
    bank: "Test Bank F Taiwan",
    ccy: "USD",
    amountMM: "30.0",
    usdEqvMM: 30.0,
    premium: "2.78%",
    dayCount: "ACT/360",
    tenorYears: "5.0",
    insuredPct: "60.00%",
    latestCommDate: "2026-02-12",
    statusUpdate: "Closed",
    nextStep: "",
    underwritingStatus: "Completed",
    coveredBy: "AA",
    status: "Closed",
  },
  {
    dealName: "Test Keystone Refi",
    sponsors: "N/A",
    bank: "Test Bank B Singapore",
    ccy: "USD",
    amountMM: "15.0",
    usdEqvMM: 15.0,
    premium: "3.00%",
    dayCount: "ACT/360",
    tenorYears: "1.5",
    insuredPct: "46.88%",
    latestCommDate: "2026-04-14",
    statusUpdate: "Closed",
    nextStep: "",
    underwritingStatus: "Completed",
    coveredBy: "AA",
    status: "Closed",
  },
  {
    dealName: "Project Lantern (Data Centre Co)",
    sponsors: "Test Infra Partners",
    bank: "Test Bank G APAC",
    ccy: "USD",
    amountMM: "TBC",
    usdEqvMM: null,
    premium: "TBC",
    dayCount: "-",
    tenorYears: "4.0",
    insuredPct: "TBC",
    latestCommDate: "2026-08-21",
    statusUpdate:
      "Rejected — offtaker concentration, speculative land-banking, weak repayment visibility on a PIK-dominant structure.",
    nextStep: "",
    underwritingStatus: "Not started",
    coveredBy: "CC / DD",
    status: "Rejected",
  },
  {
    dealName: "Working Capital Facility (Consumer Co)",
    sponsors: "N/A",
    bank: "Test Bank H (via Broker Y)",
    ccy: "TBC",
    amountMM: "TBC",
    usdEqvMM: null,
    premium: "TBC",
    dayCount: "-",
    tenorYears: "TBC",
    insuredPct: "TBC",
    latestCommDate: "2026-04-01",
    statusUpdate: "Turned Down — insufficient available economics given the risk.",
    nextStep: "",
    underwritingStatus: "N/A",
    coveredBy: "AA",
    status: "Turned Down",
  },
];

const seedArchive = [
  {
    dealName: "Project Anchor (Test Logistics Co)",
    sponsors: "Test Equity Partners",
    bank: "Test Bank A APAC",
    ccy: "USD",
    amountMM: "10.0",
    premium: "2.40%",
    dayCount: "",
    tenorYears: "4.0",
    insuredPct: "80.00%",
    closingOrDropDate: "2025-03-27",
    outcome: "Closed",
    statusNote: "Completed",
    coveredBy: "AA",
  },
  {
    dealName: "Project Delta (Test Agile Systems)",
    sponsors: "Test Buyout Group",
    bank: "Test Bank D APAC",
    ccy: "USD",
    amountMM: "30.0",
    premium: "2.75%",
    dayCount: "",
    tenorYears: "TBC",
    insuredPct: "TBC",
    closingOrDropDate: "2025-06-01",
    outcome: "Dropped",
    statusNote: "Deal dropped — missed timeline due to delays in an unrelated close.",
    coveredBy: "BB",
  },
  {
    dealName: "Project Everest (Test Fitness Co)",
    sponsors: "Test Equity Partners",
    bank: "Test Bank F Taiwan",
    ccy: "AUD",
    amountMM: "13.08 (USD 8.6)",
    premium: "2.75%",
    dayCount: "",
    tenorYears: "5.5",
    insuredPct: "50.00%",
    closingOrDropDate: "2025-10-16",
    outcome: "Closed",
    statusNote: "Completed",
    coveredBy: "AA",
  },
  {
    dealName: "Project Falcon (Test Renewables)",
    sponsors: "Test Infra Fund",
    bank: "Test Bank C HK",
    ccy: "USD",
    amountMM: "10.0",
    premium: "TBC",
    dayCount: "",
    tenorYears: "5.0",
    insuredPct: "100.00%",
    closingOrDropDate: "2025-10-16",
    outcome: "Dropped",
    statusNote: "Declined to provide full cover given the structure and offshore construction risk.",
    coveredBy: "CC / DD",
  },
];

async function main() {
  console.log("Seeding synthetic dummy data (no real deal data)...");

  for (const d of seedDeals) {
    const id = slug(d.dealName, d.bank);
    await db.insert(deals).values({ id, ...d }).onConflictDoNothing();
    await db
      .insert(dealDetails)
      .values({ dealId: id, personalNotes: "", tags: "[]", linkedEmails: "[]", priorityFlag: false })
      .onConflictDoNothing();
    await db.insert(dealUpdates).values({
      id: randomUUID(),
      dealId: id,
      occurredAt: d.latestCommDate,
      field: null,
      oldValue: null,
      newValue: null,
      statusAtTime: d.status,
      source: "import",
      note: d.statusUpdate,
    });
  }

  for (const a of seedArchive) {
    await db
      .insert(archiveDeals)
      .values({ id: slug(a.dealName, a.bank), ...a })
      .onConflictDoNothing();
  }

  console.log(`Seeded ${seedDeals.length} pipeline deals and ${seedArchive.length} archive deals.`);
}

main().then(() => process.exit(0));

// The three broad buckets every deal/discussion falls into. Live has its
// own sub-categories still to come (Joseph: "I'll get to that later") — for
// now Early Discussion and On Hold both sit under Live unchanged.
export const LIVE_STATUSES = ["Early Discussion", "On Hold"] as const;
export const CLOSED_STATUSES = ["Closed"] as const;
export const DEAD_STATUSES = ["Dropped", "Turned Down", "Rejected"] as const;

/**
 * One-line reasons for each "dead / declined" status — why the deal is
 * dead, not just that it is. Wording proposed for review; the status
 * strings themselves (Dropped / Turned Down / Rejected) are unchanged and
 * must stay unchanged, since they mirror Weekly Update.xlsx's own status
 * vocabulary 1:1 — the sync engine matches on these exact values.
 */
export const DEAD_STATUS_DEFINITIONS: Record<(typeof DEAD_STATUSES)[number], string> = {
  Dropped: "Didn't proceed for commercial or external reasons — no credit decision was made either way.",
  "Turned Down": "Declined by the APAC team at preliminary screening, before it reached full underwriting.",
  Rejected: "Declined by David and/or Andy following full underwriting review.",
};

export function dealBucket(status: string): "Live" | "Closed" | "Dead / Declined" | "Other" {
  if ((LIVE_STATUSES as readonly string[]).includes(status)) return "Live";
  if ((CLOSED_STATUSES as readonly string[]).includes(status)) return "Closed";
  if ((DEAD_STATUSES as readonly string[]).includes(status)) return "Dead / Declined";
  return "Other";
}

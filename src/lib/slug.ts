// Single source of truth for turning a (dealName, bank) pair into a stable
// identity key. Used by both the app's own DB (deals.id) and the sync
// engine's row keys — these MUST stay byte-for-byte identical, or the sync
// engine will treat every deal as unmatched (all "new" one direction, all
// "removed" the other).
export function slug(dealName: string, bank: string): string {
  return `${dealName}__${bank}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

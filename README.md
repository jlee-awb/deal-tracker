# Deal Tracker — skeleton (Phase 1 of the build plan)

Personal deal/portfolio pipeline tracker. This is the first-phase scaffold:
Next.js + Postgres (via Neon) using Drizzle ORM, seeded with **synthetic
data only** — no real Awbury deal information is in this repo.

## What changed after the first Vercel deploy attempt

The very first version of this used a local SQLite file for convenience.
That was never going to survive a real deploy: Vercel's servers don't have
that file (it's deliberately git-ignored), and the dashboard page was being
pre-built as static HTML at deploy time, which meant it tried to query a
database that didn't exist during the build itself. Two fixes:

1. Swapped the database to Postgres via Neon — one real, permanent database,
   used the same way locally and in production.
2. Marked both pages `force-dynamic`, so they query the database fresh on
   every request instead of baking a snapshot in at build time — which is
   also just correct behavior for a tracker whose data changes constantly.

## Authentication (interim)

The deployed app had zero authentication until now — anyone with the URL
could open it. `src/auth.ts` adds a single shared password (next-auth,
Credentials provider) gating every route via `src/proxy.ts` (Next 16
renamed `middleware.ts` → `proxy.ts`), plus a `requireSession()` check
inside every sync Server Action directly — Next's own docs flag that a
Server Action is invoked directly and shouldn't rely on proxy-level
redirects alone.

This is a stopgap, not real access control: one password, one identity,
no audit trail of who did what. It exists only to close the "wide open"
gap while the Entra ID conversation with IT is still pending. Two env vars
are required everywhere, including Vercel: `APP_PASSWORD` (the shared
password) and `AUTH_SECRET` (generate with `npx auth secret` or
`openssl rand -base64 32` — signs session tokens, never commit it).
Replace this with real Entra SSO once that access exists; don't extend it
with more users or roles in the meantime.

## What's here

- `src/db/schema.ts` — five tables: `deals` (mirrors the Weekly Update.xlsx
  "Current" sheet columns 1:1 — the only table that will ever sync to the
  real spreadsheet), `dealDetails` (personal-only extra layer, never synced),
  `dealUpdates` (append-only chronological log — what the timeline is built
  from), `pendingSyncChanges` (the outbound review queue for phase 4), and
  `archiveDeals` (read-only import of the Archive_2025 sheet).
- `drizzle/0000_*.sql` — the migration that creates all five tables, already
  generated offline. Applying it just needs a real database to point at.
- `src/db/seed.ts` — 10 synthetic pipeline deals + 4 synthetic archive deals,
  shaped exactly like the real workbook (same columns, same status
  vocabulary) but with invented names, banks and figures.
- `src/lib/dealTaxonomy.ts` — the three broad buckets every deal falls into
  (Live, Closed, Dead / Declined), plus one-line reasons for each of the
  three dead/declined statuses. The status strings themselves (Dropped /
  Turned Down / Rejected) are unchanged — they mirror Weekly Update.xlsx's
  own vocabulary, which the sync engine matches on exactly. Live's own
  sub-categories are intentionally not built yet.
- `src/app/page.tsx` — dashboard: KPI header, a dead/declined-by-reason
  breakdown (total deals ever shown vs. how many died, and why), and the
  pipeline grouped first by the three broad buckets and then by status
  within each, with an "Updated" badge for anything touched in the last 7
  days.
- `src/app/deals/[id]/page.tsx` — deal detail page: full column set, plus
  the chronological update timeline with Earlier/Later navigation.
- `src/sync/` — the two-way reconciliation engine for Weekly Update.xlsx
  (see below).

## Setting up the database (one-time)

1. Create a free project at neon.tech. Copy its connection string.
2. On Vercel: Project Settings → Environment Variables → add `DATABASE_URL`
   with that connection string. Redeploy.
3. Vercel runs `vercel-build` automatically (see `package.json`), which
   applies the migration and loads the synthetic seed data before building
   — so the very next deploy should show the dummy pipeline data live.

## Running it locally

```bash
cp .env.local.example .env.local   # then paste your real Neon connection string in
npm install
npm run db:migrate   # applies drizzle/0000_*.sql
npm run db:seed       # loads the synthetic data
npm run dev           # http://localhost:3000
```

## Two-way sync engine (`src/sync/`)

**Wired in, not yet connected to a real workbook.** The reconciliation
engine (below) now drives an actual review queue in Postgres and a `/sync`
page — but until `GraphExcelAdapter` exists, `getAdapter()` only knows how
to point at a local throwaway `.xlsx` via `SYNC_LOCAL_XLSX_PATH` (dev/
testing only), so calling it in production today throws a clear error
rather than silently doing nothing.


Reconciles `deals` against the "Current" sheet of Weekly Update.xlsx in both
directions, without ever silently overwriting either side:

- `types.ts` — `SheetDealRow` (the 12 MD-facing fields that cross the sync
  boundary) and the `SheetAdapter` interface, so the reconciliation logic
  never talks to Excel or Graph directly.
- `reconcile.ts` — the actual merge algorithm. Given the live sheet, the
  app's current state, and the last snapshot both sides agreed on, it
  produces: safe pulls (sheet changed, app didn't — auto-applied), genuine
  conflicts (both sides changed the same field to different values — never
  auto-resolved, always surfaced for a decision), and an outbound queue (app
  changed, sheet didn't — held for manual approval before anything is
  written back).
- `adapters/exceljsAdapter.ts` — a local-file implementation of
  `SheetAdapter`, used for testing. Refuses to write to formula-bearing
  columns and regenerates the right formulas for newly appended rows.
  The production counterpart (`GraphExcelAdapter`, not yet built) will
  implement the same interface against Microsoft Graph, once write-scoped
  Entra credentials exist — nothing in `reconcile.ts` will need to change.
- `mapping.ts` / `plan.ts` — the DB-shape-aware layer between `reconcile()`
  and Postgres. `plan.ts` is still pure (no I/O): it turns the engine's
  output into an exact, idempotent set of writes (which `deals` fields to
  update directly, which new deals to insert, which review-queue rows to
  add — deduped against whatever's already pending — and which stale
  outbound rows have escalated into conflicts and need superseding).
- `runSync.ts` — the pull orchestrator: reads `deals` + the live sheet,
  calls `plan.ts`, applies the result inside one transaction.
- `resolve.ts` — what happens when Joseph acts on a review-queue row:
  approve/reject an outbound change, resolve a conflict (keep the app's
  value, keep the sheet's, or type a replacement), or acknowledge a deal
  that disappeared from the sheet. A conflict resolved as "keep sheet" is
  applied to the app immediately, since there's nothing to push.
- `runPush.ts` — batches every row already marked `approved` (clean
  outbound pushes, plus conflicts resolved in the app's favor) into one
  `writeChanges()` call, then marks them synced and advances their
  snapshots.
- `src/app/sync/` — the review page and its Server Actions. Shows
  conflicts, outbound changes, and removed-from-sheet items with the
  actions above; "Run sync now" and "Push approved changes" trigger the
  two orchestrators.
- `__tests__/` — a throwaway synthetic `.xlsx` fixture generator, a full
  reconciliation cycle against it, and the planning-layer behaviour on top
  (dedup on repeat pulls, outbound→conflict escalation). Run it with
  `npm run test:sync`. All 19 assertions pass as of this writing. No real
  Awbury data is touched anywhere in this test — it's a synthetic file
  written into a git-ignored `test-fixtures/` folder and deleted/recreated
  on each run. This only covers logic that doesn't need a live database —
  `runSync.ts`/`runPush.ts`/`resolve.ts` themselves are exercised by
  `tsc`'s type-check but not yet by an end-to-end test against a real
  Postgres instance.

### Known simplification: deals removed from the sheet

Acknowledging a "removed from the sheet" item currently only clears it from
the queue — it doesn't move the deal into `archiveDeals` or change its
status. Doing that automatically would mean deciding, unasked, whether to
keep or discard the deal's own `dealUpdates` history (cascading a delete
into `archiveDeals` would erase it, since that table has no history of its
own). That's a real decision, not a default worth guessing at — flagging it
here rather than building a silent behaviour around it.

## Not in this phase yet

- Real authentication (Entra ID / Microsoft sign-in) — currently no auth at
  all. The deployed app is openly accessible to anyone with the URL until
  this is fixed.
- `GraphExcelAdapter` — the production Microsoft Graph adapter for the real
  Weekly Update.xlsx. Blocked on a write-scoped Entra app registration
  (today's session only has read access via the M365 connector).
- A review/approve UI surfacing `pendingSyncChanges` — nothing currently
  calls `reconcile()` outside the test; it isn't wired into any API route
  or scheduled job yet.
- Once real deal data is involved, the `vercel-build` auto-seed step needs
  to be removed — it's a phase-1 convenience for dummy data only.

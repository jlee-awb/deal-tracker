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
- `src/app/page.tsx` — dashboard: KPI header (computed live from the DB,
  mirrors the Notes-sheet counts) + pipeline grouped by status, with an
  "Updated" badge for anything touched in the last 7 days.
- `src/app/deals/[id]/page.tsx` — deal detail page: full column set, plus
  the chronological update timeline with Earlier/Later navigation.

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

## Not in this phase yet

- Real authentication (Entra ID / Microsoft sign-in) — currently no auth at
  all.
- The two-way sync engine against the real Weekly Update.xlsx (pull ↔
  reconcile ↔ review queue ↔ push) — deliberately not started yet, and
  should be built and tested against a throwaway copy of the workbook before
  it ever touches the live file, since colleagues edit it directly too.
- Once real deal data is involved, the `vercel-build` auto-seed step needs
  to be removed — it's a phase-1 convenience for dummy data only.

# Deal Tracker — skeleton (Phase 1 of the build plan)

Personal deal/portfolio pipeline tracker. This is the first-phase scaffold:
Next.js + a local SQLite database (via Drizzle ORM) seeded with **synthetic
data only** — no real Awbury deal information is in this repo.

## What's here

- `src/db/schema.ts` — four tables: `deals` (mirrors the Weekly Update.xlsx
  "Current" sheet columns 1:1 — the only table that will ever sync to the
  real spreadsheet), `dealDetails` (personal-only extra layer, never synced),
  `dealUpdates` (append-only chronological log — what the timeline is built
  from), `pendingSyncChanges` (the outbound review queue for phase 4), and
  `archiveDeals` (read-only import of the Archive_2025 sheet).
- `src/db/seed.ts` — 10 synthetic pipeline deals + 4 synthetic archive deals,
  shaped exactly like the real workbook (same columns, same status
  vocabulary) but with invented names, banks and figures.
- `src/app/page.tsx` — dashboard: KPI header (computed live from the DB,
  mirrors the Notes-sheet counts) + pipeline grouped by status, with an
  "Updated" badge for anything touched in the last 7 days.
- `src/app/deals/[id]/page.tsx` — deal detail page: full column set, plus
  the chronological update timeline with Earlier/Later navigation.

## Running it locally

```bash
npm install
npx drizzle-kit push   # creates dev.db from schema.ts
npx tsx src/db/seed.ts  # loads the synthetic data
npm run dev             # http://localhost:3000
```

## Not in this phase yet

- Real authentication (Entra ID / Microsoft sign-in) — currently no auth at
  all, since this only ever runs against dummy data on your own machine so
  far.
- Deployment (Vercel) + a real Postgres database (Neon) — `src/db/client.ts`
  is written so only that one file changes when you're ready to point it at
  Postgres instead of the local SQLite file; the schema and every query stay
  the same.
- The two-way sync engine against the real Weekly Update.xlsx (pull ↔
  reconcile ↔ review queue ↔ push) — deliberately not started yet, and
  should be built and tested against a throwaway copy of the workbook before
  it ever touches the live file, since colleagues edit it directly too.

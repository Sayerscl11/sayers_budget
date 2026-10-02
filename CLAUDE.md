# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A weekly **"safe-to-spend"** household budgeting app (Coty & Kia Sayers). It
forecasts from constant recurring income/bills and shows one number — how much
is free to spend on personal stuff this week — that auto-adjusts as spending is
logged. Ingests transactions from Capital One 360 PDF statements, manual entry,
and (later) Plaid. Stack: Next.js 15 App Router + React 19 + Tailwind, Supabase
(Postgres + Auth + RLS), `pdfjs-dist`, `plaid`, Vitest.

## Commands

```bash
npm test                              # all Vitest unit tests (parser + engine + ingest)
npx vitest run tests/forecast.test.ts # a single test file
npx vitest -t "safe-to-spend"         # tests matching a name
npm run typecheck                     # tsc --noEmit (run after any change)
npm run build                         # next build (full type-check of app + routes)
npm run dev                           # next dev (needs .env.local for Supabase paths)
```

By default the app runs **with no database**: the data layer is backed by the
committed statement fixtures (see "Data source seam"), so `npm run build` /
`npm run dev` and the dashboard work end-to-end out of the box. Setting
`NEXT_PUBLIC_DATA_SOURCE=supabase` (plus the Supabase keys in `.env.local`)
switches to live data and turns on auth, onboarding, and PDF import.

`test:e2e` is declared in `package.json` but there is no Playwright config or
`e2e/` folder yet.

### Validating SQL migrations without Supabase

To test migrations without touching the live project, apply `supabase/migrations/*` to a throwaway local Postgres with a tiny `auth` shim (Supabase provides
`auth.users` and `auth.uid()`):

```sql
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
```

Then run migrations in order. To test RLS, `set role authenticated` (a
non-superuser; superusers bypass RLS) and `set request.jwt.claim.sub = '<uuid>'`.

## Architecture: the core/adapter boundary

The single most important rule: **`src/core/**` is pure, framework-agnostic
TypeScript.** It must not import Next, React, Supabase, Plaid, or `node:*`.
Everything stateful (DB, HTTP, filesystem, "what is today") is an adapter in
`src/lib/**` and `src/app/**` that calls into the pure core. This keeps the two
riskiest pieces — the statement **parser** and the budget **engine** — unit
tested in isolation against real (sanitized) statements.

Two invariants the whole codebase depends on:
- **Money is always integer cents** (signed: negative = outflow). Convert only
  via `src/core/money.ts`. DB money columns are `bigint`.
- **Dates are ISO `yyyy-mm-dd` strings**; the engine never calls `Date.now()`.
  Callers resolve "today" in the household timezone and pass it in
  (`src/core/dates.ts` does all calendar math on UTC-midnight dates).

### The classifier is the heart of the model (`src/core/engine/classify.ts`)

`budgetBucket(txn, accounts)` encodes the household's actual bookkeeping and
every other engine function keys off it:
- The **main checking account drives everything.** The spending-pool (`...2997`)
  and savings-pool (`...5534`) accounts are downstream **mirrors** → bucket
  `mirror`, ignored, to avoid double-counting.
- **Discretionary spend** = labeled `"... - Withdrawal to Debit Card Account"`
  outflows in checking; the label *is* the category.
- **Savings** = outflows to Performance Savings / Wealthfront (separate goal,
  never subtracted from safe-to-spend). Money pulled back is a neutral transfer.

### The engine pipeline (`src/core/engine/`)

`transfers` → `classify` → `recurring` (group by normalized stem, ≥2
occurrences, cadence from median date-gap, amount = **median** with min/max so
variable rent works) → `period` (project recurring across a window; savings
excluded from bills) → `safeToSpend` (`floor(net / weeks)`) → `weeklySpend`
(discretionary spent-so-far this week) → `savings`.

`forecast()` (`engine/forecast.ts`) composes all of the above into the single
view-model the UI renders. **Key decision:** the default forecast window is a
**normalized 12-month span**, not the current calendar month. Because income is
biweekly, a single month has 2 or 3 paychecks and the weekly number would swing
wildly (observed −$217↔+$666); the 12-month window makes each cadence land a
whole number of times → a stable ~$108/wk. Don't revert this to a single month.

### The parser (`src/core/parser/`)

Consumes the plain text of a Capital One 360 statement (newline-separated, as
pdf.js extraction produces) → `RawTxn[]`. Pure and deterministic, tested from
`.txt` fixtures with no PDF runtime. Pipeline: tokenize lines → assign to one of
3 accounts by header/mask → detect row starts and **re-join wrapped description
lines** → regex fields, cross-check sign vs. running-balance delta (`needsReview`
on mismatch) → normalize stem + extract label → `dedupeKey =
hash(accountMask, postedDate, amountCents, descriptionNorm)` (excludes source so
PDF and Plaid for the same event collide intentionally). `rawTxnsToTxns()`
bridges `RawTxn` → the engine's `Txn`.

### Data source seam (`src/lib/data/`)

The UI calls `loadBudgetData()` (`source.ts`), never a DB directly. It returns
the `demo` source (`demo.ts`, parses the committed fixtures) unless
`useSupabaseData()` (`lib/env.ts`) is true, in which case it lazy-imports
`supabase.ts` — lazily so the demo build never pulls in `next/headers`. Both
return the same `BudgetData` shape, so the UI is identical. `demo.ts` anchors
"today" to the latest transaction so the dashboard reflects real data.

Auth, onboarding, and server actions are gated on Supabase mode; keep new
write paths behind the same check so the demo build stays DB-free.

### PDF import (`src/lib/pdf/extractText.ts`, `src/app/(app)/import/`)

`extractText` turns an uploaded PDF into the newline text the pure parser
consumes. Two settings in `next.config.mjs` are load-bearing: `pdfjs-dist` is in
`serverExternalPackages` (bundling it breaks worker/font resolution), and the
Server Action body limit is raised to 15mb for statement uploads. Flow:
preview (`api/import/preview`) → `reconcileIngest` plan → `lib/ingest/persist.ts`.

### Recurring overrides (`src/core/engine/recurringPlan.ts`)

Pure merge of auto-detected candidates with the user's saved rows in
`recurring_items` (confirm / edit / toggle in the Recurring manager). With zero
overrides it must reproduce `defaultForecastItems` exactly, so edits only ever
refine the same baseline number.

### Cross-source dedupe (`src/lib/ingest/reconcile.ts`)

`reconcileIngest(existing, incoming)` is a **pure** function returning an
insert/replace/supersede/skip *plan* (the Supabase adapter applies it in one
transaction). Source priority **Plaid > PDF > manual**; exact `dedupeKey`
collisions upgrade or skip; fuzzy supersession matches same account + exact
amount + ±3 days + token-overlap description, preserving user category/
attribution. Re-importing an unchanged statement must be a complete no-op.

### Database (`supabase/migrations/`)

Six ordered migrations (`0006` adds `household_invites`: the owner records the
partner's email, and the server accepts the invite with the service role on
that partner's first sign-in, since an invitee has no household for RLS yet). Every household-scoped table carries `household_id` and
its RLS policy is `household_id = current_household()`, where
`current_household()` is a `SECURITY DEFINER` helper resolving `auth.uid()` →
`memberships.household_id` (so both spouses share one budget). `transactions`
has `unique(household_id, dedupe_key)` and `unique(household_id, source,
source_ref)`. The `plaid_items` access token is encrypted and has **no
authenticated RLS policy** — only the service role reads it.

## Milestone status

M0/M1 (pure core) and most of M2 are done: `forecast()`, the Next.js app +
dashboard, Supabase client wiring and live data source, email/password auth +
household onboarding with invites, PDF ingest (extract → parse → dedupe →
persist), the Recurring manager, and manual quick-add + tap-to-categorize on
Activity. Remaining: M3 savings goals, M4 Plaid, M5 polish, and the Playwright
happy-path. Full design is in `docs/PLAN.md`; `docs/HANDOFF.md` is the original
M2 build order and is now mostly historical.

## Conventions

- Comments explain *why* (the household model, a non-obvious decision), not
  *what*. Match the existing density and tone.
- New pure logic goes in `src/core/**` with a Vitest test against the fixtures;
  anything touching IO/DB/HTTP goes in `src/lib/**` or `src/app/**`.
- The `@core/*` and `@/*` path aliases map to `src/core/*` and `src/*`.

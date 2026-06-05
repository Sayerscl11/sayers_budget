# Handoff — Sayers Budget

_Last updated by the M0/M1 build session._

## TL;DR
- **M0 (scaffold) and M1 (pure budgeting core) are complete** and committed at
  `c6cc4b5` on branch `claude/compassionate-clarke-VIQoc`.
- **42 unit tests pass**; clean `tsc` typecheck. End-to-end over 5 real
  statements the engine computes a realistic **~$243/week** safe-to-spend.
- The original web session could **not push** (the GitHub App was scoped
  read-only — `403 Resource not accessible by integration`). The work was
  preserved via a git bundle and this commit. Once write access is granted,
  push the branch.

## If you're a fresh session picking this up
1. Ensure this branch is on the remote. If it isn't, the user has a git bundle
   (`sayers_budget_m0_m1.bundle`); apply it:
   `git fetch sayers_budget_m0_m1.bundle 'refs/*:refs/*'` then
   `git push origin claude/compassionate-clarke-VIQoc`.
2. `npm install` then `npm test` — expect 42 passing tests.
3. The full approved design is in **`docs/PLAN.md`**. Read it before continuing.

## What exists now
```
src/core/parser/   Capital One 360 statement parser (text -> RawTxn[])
src/core/engine/   transfers, classify, recurring, period, safeToSpend,
                   weeklySpend, savings  (all pure, unit-tested)
src/core/          types.ts, money.ts (integer cents), dates.ts (week/cadence)
tests/             parser.test.ts, engine.test.ts, _load.ts, fixtures/*.txt
```
Key model decisions already encoded (see `src/core/engine/classify.ts`):
- The **main checking account** drives everything. The `...2997` (spending pool)
  and `...5534` (savings pool) accounts are **mirrors** and are ignored.
- **Discretionary spend** = labeled `"... - Withdrawal to Debit Card Account"`
  rows in checking; the label is the category.
- **Savings** = outflows to Performance Savings / Wealthfront (separate goal,
  not subtracted from safe-to-spend). Inflows back from those are neutral
  transfers.
- **Safe-to-spend** = (recurring income − recurring bills) ÷ weeks.

## Next: M2 — the usable app (Next.js + Supabase)
Build in this order (deliver the dashboard early):
1. **Next.js App Router scaffold**: `src/app/`, Tailwind + shadcn/ui, `globals.css`,
   root layout, `lib/env.ts` (zod-validated env), `lib/supabase/{server,browser,
   admin,middleware}.ts`, `middleware.ts` for session.
2. **Supabase migrations** `supabase/migrations/0001..0005` per `docs/PLAN.md`
   data model (households, memberships, accounts, transactions w/ `dedupe_key`
   unique, categories, label_category_map, recurring_items, savings_goals,
   plaid_items, import_batches) + RLS via `current_household()`.
3. **PDF runtime extraction**: a `lib/pdf/extractText.ts` using `pdfjs-dist` to
   turn an uploaded PDF buffer into the newline text the existing
   `parseStatement()` already consumes. Validate its output matches the fixture
   format (the parser is text-based and tested).
4. **Ingest + dedupe**: `lib/ingest/{fromPdf,fromManual,fromPlaid}.ts` →
   upsert on `(household_id, dedupe_key)` with source priority Plaid>PDF>manual;
   `import_batches.file_hash` idempotency.
5. **Server actions / API**: `app/api/import/pdf/route.ts` (parse→preview→commit),
   recurring detect endpoint, transaction CRUD actions.
6. **UI**: `(app)/dashboard` (hero safe-to-spend using the engine), `transactions`
   (list + quick categorize + manual quick-add), `recurring` (Income/Bills
   manager; surface `RecurringCandidate.regular` to default-select steady income),
   `import` (PDF dropzone + preview), `savings`, `onboarding`, auth pages.

## Then M3 savings · M4 Plaid · M5 polish
- Plaid sandbox creds are in the user's local `.env.local` (gitignored):
  `PLAID_CLIENT_ID` / `PLAID_SECRET` / `PLAID_ENV=sandbox`. Capital One is Plaid
  `ins_128026`. Keep secrets server-side only.

## Verification
- `npm test` (engine + parser). Add `lib/ingest` integration tests against a
  local Supabase, and one Playwright happy-path (import fixture → categorize →
  dashboard number → quick-add reduces remaining).
- Real-world acceptance: reconcile computed monthly income/bills/safe-to-spend
  against the household's spreadsheet.

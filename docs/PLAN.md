# Sayers Budget — Weekly "Safe-to-Spend" App

## Context

Coty & Kia currently run their household budget manually: every pay period Kia
reviews money in vs. money out and figures out how much is left for personal
spending. We're replacing that with an automated, mobile-friendly web app that
forecasts from their **constant recurring income and bills** and shows one
headline number — **"safe to spend this week"** — that auto-adjusts as they log
discretionary purchases (dinner, groceries, gas...).

The repo is currently empty (only a README). This plan builds the whole app from
scratch.

### Grounded in real data
I analyzed 5 real Capital One 360 statements (1,177 transactions). Findings that
drive the design:
- **3 accounts:** `360 Checking ...4333` (main), `Debit Card Account ...2997`
  (their discretionary spending pool), `360 Performance Savings ...5534`.
- **Recurring income:** Intralox payroll ~$2,117 (biweekly), Natchaug payroll
  ~$1,310, Women & Infants salary ~$1,203, ~$110/mo interest.
- **Recurring bills:** Rent (Legacy Real Estate) ~$2,160–2,965, Capital One card
  ~$1,400, Nissan loan $468.72, ATT $189, Verizon $89.99, PPL electric ~$206,
  MassMutual $118.28, Planet Fitness $24.56, Goldfish Swim $144, Zelle→Joanne
  Stokes ~$2,360, Wealthfront ~$300 (savings).
- **Discretionary spend = outflows from the `...2997` account**, each hand-labeled
  (Gas, Costco, Dinner, Coffee, Grocery, Diapers...). The app formalizes this.
- **Large internal transfers** move between the 3 accounts and **must be netted
  out** of income/expense or the math breaks.

### Confirmed product decisions
- **Weekly safe-to-spend** = `(recurring income − recurring bills) ÷ weeks in period`.
- **Savings is NOT subtracted** — tracked separately as a goal with progress.
- **Personal spend tracked** = spending-pool (`...2997`) outflows, auto-categorized
  from labels, fully editable.
- **Three ingest sources, built now:** PDF statement import + manual quick-add +
  **Plaid live-sync** (Capital One = Plaid `ins_128026`).
- **Stack:** Next.js (App Router) + TS + Tailwind + shadcn/ui, Supabase (Postgres
  + Auth + RLS), deployed to Vercel. Email/password auth, Google-SSO-ready, shared
  household for both spouses.

### What I need from Coty (during/after build)
- A free **Plaid** account → `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (start
  in sandbox). Note: Capital One via Plaid may require Plaid production approval;
  the PDF path means the app is fully usable meanwhile.
- A **Supabase** project (URL + anon key + service-role key) and **Vercel** project.
- Note: the Capital One **DevExchange** account is *not* used — it's for building
  on Capital One's own product APIs, not reading personal transactions.

---

## Architecture

**Core principle:** a framework-agnostic `src/core/**` (pure TypeScript, no
Next/React/Supabase/Plaid imports, enforced by an ESLint boundary rule) holding
the two riskiest pieces — the **statement parser** and the **budget engine** —
so they're unit-testable in isolation against the real statements. Everything
stateful (DB, Plaid, HTTP) lives in `src/lib/**` and `src/app/**` as adapters.

Money is stored as integer **cents** everywhere. Week boundaries use a household
`timezone` (`America/New_York`) + `week_start_dow` via a `core/dates.ts` helper —
never raw `Date.now()`.

### Directory layout (key paths)
```
src/core/parser/      index, tokenize, sections, rows, fields, normalize, dedupeKey, patterns
src/core/engine/      transfers, recurring, classify, period, safeToSpend, weeklySpend, savings
src/core/             types.ts, money.ts, dates.ts
src/lib/supabase/     server.ts, browser.ts, admin.ts (service-role), middleware.ts
src/lib/plaid/        client.ts (secrets), sync.ts
src/lib/db/           transactions, recurring, accounts, categories, savings, household (typed repos)
src/lib/ingest/       fromPdf.ts, fromManual.ts, fromPlaid.ts  (normalize → dedupe upsert)
src/lib/env.ts        zod-validated env (server vs NEXT_PUBLIC)
src/app/(auth)/       login, signup
src/app/(app)/        dashboard, transactions, recurring, savings, import, connect, onboarding
src/app/api/          import/pdf, plaid/{link-token,exchange,sync,webhook}, recurring/detect
src/app/actions/      transactions, recurring, categories, savings (server actions)
src/components/       ui/ (shadcn), dashboard/, transactions/, recurring/, savings/, import/, nav/
supabase/migrations/  0001 households+auth, 0002 accounts+transactions, 0003 recurring+categories,
                      0004 savings+plaid, 0005 rls_policies
tests/                fixtures/ (extracted text from 5 real statements), parser + engine + e2e tests
```

### Libraries
`pdfjs-dist` (position-aware PDF text extraction), `plaid` + `react-plaid-link`,
`@supabase/ssr`, `zod` (all boundaries), `date-fns`/`date-fns-tz`, `recharts`
(progress ring / weekly bars), `vitest` (unit), `playwright` (one E2E).

---

## Data model (Supabase Postgres, RLS on every household-scoped table)

All household tables carry `household_id`; a `current_household()` SECURITY
DEFINER helper resolves `auth.uid()` → `memberships.household_id`, and every RLS
policy is `household_id = current_household()` (so both spouses share one budget).
Money columns are `bigint` cents.

- **households** (name, timezone, week_start_dow), **memberships** (user_id,
  display_name "Coty"/"Kia", role)
- **accounts** (name, mask, kind, `role`: `main|spending_pool|savings_pool|other`,
  plaid_account_id) — `role` is the semantic hook the engine keys off.
- **transactions** — posted_date, description_raw/norm, `label`, signed
  amount_cents, running_balance_cents, `type` (income|expense|transfer),
  category_id, `is_transfer`, `transfer_group_id`, `source` (pdf|manual|plaid),
  `source_ref`, **`dedupe_key`**, attributed_to, `user_overridden`.
  **unique(household_id, dedupe_key)** anchors dedupe.
- **categories** + **label_category_map** (editable label→category, seeded:
  Costco→Groceries, Dinner/Coffee→Dining, Gas→Gas, Diapers/Litter→Kids/Pets...).
- **recurring_items** — unified income & bills: direction, name, match_norm,
  cadence, anchor_date, amount_cents, amount_source (detected|override),
  detected_amount_cents, account_id, is_active, `is_savings`, auto_detected.
- **savings_goals** (target_cents, account_id, includes_wealthfront); progress is
  *derived* from transactions, not stored.
- **plaid_items** (item_id, **access_token encrypted at rest** via Vault/pgsodium,
  service-role-only; institution_id, cursor, status).
- **import_batches** (file_hash unique → re-upload is a no-op).

---

## Budget engine (`src/core/engine/**`, pure functions)

1. **transfers.ts** — `detectTransfers(txns, accounts)`. Primary signal: statement
   descriptions literally name the counterparty account ("Withdrawal to 360
   Performance Savings", "Deposit from 360 Checking"). Flag any txn referencing an
   *owned* account as a transfer; pair outflow↔inflow (equal amount, ≤3 days,
   cross-referencing desc) into a `transfer_group_id`. Transfers into
   savings_pool / Wealthfront get `isSavings=true`. Transfers are excluded from
   income/bill/expense totals (so debit-card funding moves don't double-count vs.
   the actual spend).
2. **recurring.ts** — drop transfers, split by sign, normalize merchant stem
   (curated dictionary for known merchants + generic stemmer), group by stem,
   require ≥2 occurrences, infer cadence from median date-gap (6–8d weekly,
   12–16d biweekly, 27–34d monthly, else irregular), amount = **median** with
   min/max range (handles rent's $2,160–$2,965 swing). User override wins.
3. **classify.ts** — precedence: user override > transfer > recurring income >
   recurring bill > spending-pool outflow (=discretionary) > sign default.
4. **period.ts** — project recurring items by cadence across a period; sum income
   and bills (savings-flagged items excluded from bills). `weeksInPeriod()`.
5. **safeToSpend.ts** — `floor((income − bills) / weeks)` + a `breakdown` variant
   powering the dashboard "why this number" sheet.
6. **weeklySpend.ts** — sum current-week discretionary (spending-pool, non-transfer)
   outflows → spent / remaining / byCategory.
7. **savings.ts** — sum contributions into savings_pool + Wealthfront → progress;
   never touches safe-to-spend.

---

## Statement parser (`src/core/parser/**`)

Pipeline (testable from `.txt` fixtures): **tokenize** pdf.js items into visual
lines by Y-position → **sections** assign lines to one of the 3 accounts by
header/mask → **rows** detect a txn start (`^MonthAbbr Day` + trailing
`$amount $balance` + `Debit|Credit`) and **re-join wrapped description lines**
(any non-dated, non-header line is a continuation) → **fields** regex out
date/desc/type/sign/amount/balance, cross-check sign vs running-balance delta and
flag `needsReview` on mismatch → **normalize** merchant stem + extract label via
`^(label) - Withdrawal to Debit Card Account` → **dedupeKey** =
`hash(accountMask, postedDate, amountCents, descriptionNorm)` (excludes source so
PDF and Plaid for the same event collide intentionally). Output: `{transactions,
accounts, warnings, needsReview}`, fully deterministic.

## Cross-source dedupe (PDF / manual / Plaid)
- **Canonical key** `unique(household_id, dedupe_key)` with source-priority upsert
  (Plaid > PDF > manual) — never duplicates a row.
- **Plaid `transaction_id`** unique on `(household_id, source, source_ref)`.
- **Fuzzy reconcile pass** after ingest: same account, equal amount, ±3 days, high
  desc similarity → soft-supersede the lower-priority row (auditable, carries over
  category/attribution). Handles "logged dinner manually, then import arrived."
- `import_batches.file_hash` + Plaid `cursor` make re-imports idempotent.

## Plaid flow (secrets server-side only)
`/api/plaid/link-token` (Supabase-authed) → `react-plaid-link` on `/connect`
(prefilter Capital One) → `/api/plaid/exchange` stores encrypted token + maps
Plaid accounts to our `accounts` by mask → `lib/plaid/sync.ts` runs
`transactionsSync` loop with cursor → webhook `/api/plaid/webhook`
(`SYNC_UPDATES_AVAILABLE`, JWT-verified) + manual "Refresh" + daily Vercel Cron.
`ITEM_LOGIN_REQUIRED` → "Reconnect bank" via Link update mode.

---

## UI (mobile-first, bottom nav: Dashboard · Transactions · Recurring · Savings · More)

- **Dashboard** — hero "$X safe to spend this week", weekly progress bar
  (amber/red as it depletes), tappable breakdown, this-week spend-by-category,
  savings ring, empty-state CTA.
- **Transactions** — day-grouped feed, tap-to-categorize, uncategorized pinned
  ("3 need a category"), filters, FAB → manual quick-add sheet (amount, merchant,
  category, who, date).
- **Recurring** — Income/Bills tabs, each with amount ("varies" range), cadence,
  next-expected; edit sheet (override amount, change cadence, mark not-recurring,
  add manual); "Detected (review)" section to confirm/dismiss auto-found items.
- **Savings** — goal ring, contribution history, clear copy that it doesn't reduce
  safe-to-spend.
- **Import** — PDF dropzone → preview table (transfer/needs-review flags, edit
  categories, dedupe result "12 new, 4 already imported") → commit.
- **Connect** — Plaid Link, status, refresh, reconnect banner.
- **Onboarding** — wizard: confirm household + names → import/connect → confirm
  detected income/bills → set a savings goal → land on a real dashboard number.
- **Auth** — email/password, Google SSO button wired for later.

---

## Milestones (working app early, Plaid layered on)

- **M0 — Scaffold:** Next+TS+Tailwind+shadcn, env validation, Supabase project,
  migrations 0001–0002, RLS skeleton, auth + middleware, `(app)` shell + bottom
  nav, seed Coty & Kia household, ESLint boundary on `core/`.
- **M1 — Core (TDD, highest value first):** `core/parser/**` + `core/engine/**`
  proven by unit tests against the 5 real statements. No UI.
- **M2 — Usable app:** PDF import (parse → `fromPdf` → dedupe upsert) + preview UI,
  manual quick-add, transactions list + categorize, recurring detection persisted
  + manager, **dashboard safe-to-spend number**. Fully usable from PDFs alone.
- **M3 — Savings goals.**
- **M4 — Plaid:** token flow, encrypted item storage, sync + webhook + cron,
  connect screen, reconcile against existing PDF data.
- **M5 — Polish:** attribution UI, needs-review workflows, Google SSO, reauth
  states, charts, Playwright E2E, perf at 1,000+ txns.

---

## Verification

- **Unit (Vitest):** commit sanitized extracted text of the 5 statements to
  `tests/fixtures/`; assert per-account row counts, wrapped-line rejoining,
  date/year rollover, label extraction, transfer netting, cadence inference
  (Intralox→biweekly, Nissan/ATT/Verizon→monthly), rent amount = median of range,
  safe-to-spend math (savings excluded), current-week discretionary spend. Freeze
  "today" via injected config.
- **Integration:** `lib/ingest/*` dedupe/idempotency against a local Supabase test
  DB — re-import = no-op, PDF↔Plaid no double-count, manual supersession.
- **E2E (Playwright):** sign in → import a fixture PDF → see N txns → categorize one
  → dashboard shows expected number → quick-add a $40 dinner → remaining drops $40.
- **Real-world acceptance:** run the engine over all 5 statements and reconcile
  computed monthly income/bills/safe-to-spend against the couple's spreadsheet.

## Key risks (mitigations in design)
PDF layout drift → position-based tokenizer + `needsReview` (never auto-commit
garbage); merchant-stem collisions → curated dictionary + audit links to
split/merge; half-visible transfers → flag by name even when unpaired; dedupe
edge cases → exact Plaid IDs + tiebreaker + soft-supersede; variable bills →
median+range; week/timezone determinism → `dates.ts`; Plaid token security →
encrypted, service-role-only, never client-exposed.

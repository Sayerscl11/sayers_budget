# Sayers Budget

A weekly **"safe-to-spend"** budgeting app for a household. It forecasts from the
constant recurring income and bills, then shows one number — how much is free to
spend on personal stuff this week — that auto-adjusts as spending is logged.

It ingests transactions from **Capital One 360 PDF statements**, **manual entry**,
and **Plaid** live-sync, normalizes them into one ledger, and computes the budget
with a pure, well-tested engine.

## How the budget works

- **Safe-to-spend (weekly)** = `(recurring income − recurring bills) ÷ weeks in period`.
- **Savings is tracked separately** as a goal and is *not* subtracted from the
  weekly number.
- **Personal/discretionary spend** = the household's labeled
  "Withdrawal to Debit Card Account" entries in checking (e.g. *Dinner, Gas,
  Costco*), auto-categorized from those labels.
- **Internal transfers** between the household's own accounts are detected and
  netted out so they never count as income or expense.

## Architecture

```
src/core/        Pure, framework-agnostic TypeScript (no Next/React/Supabase/Plaid)
  parser/        Capital One 360 statement parser (text -> normalized transactions)
  engine/        Budgeting engine: transfers, recurring detection, safe-to-spend
  money.ts       Integer-cents helpers
  dates.ts       Week boundaries, cadence math
tests/           Vitest unit tests + sanitized statement fixtures
```

The two highest-risk pieces — the statement **parser** and the budget **engine** —
are pure and unit-tested in isolation against real (sanitized) statements. The
web app, database, and bank integrations are adapters around this core. Money is
always stored as integer **cents**.

## Status

- [x] **M0/M1** — project scaffold + the pure core (parser + engine) with tests
- [ ] **M2** — PDF import + manual entry + dashboard (Next.js + Supabase)
- [ ] **M3** — savings goals
- [ ] **M4** — Plaid live-sync
- [ ] **M5** — polish, SSO, E2E

## Development

```bash
npm install
npm test          # run the engine + parser unit tests
npm run typecheck
npm run dev        # (once the web app lands in M2)
```

Copy `.env.example` to `.env.local` and fill in Supabase + Plaid credentials.
Secrets are never committed.

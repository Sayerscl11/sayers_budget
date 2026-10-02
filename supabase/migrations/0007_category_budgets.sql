-- 0007 — Category budgets ("envelopes"). The household's real budgeting model:
-- a monthly cap per discretionary category, drawn down by labeled spend. The
-- `category` matches transactions.label. Progress (spent/remaining, including
-- rollover) is DERIVED from transactions by the engine — only the cap, rollover
-- choice, and start month are stored here.

create table category_budgets (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  category      text not null,
  monthly_cents bigint not null check (monthly_cents >= 0),
  rollover      boolean not null default true,
  start_month   text not null, -- 'yyyy-mm'
  created_at    timestamptz not null default now(),
  unique (household_id, category)
);

create index category_budgets_household_idx on category_budgets(household_id);

alter table category_budgets enable row level security;

create policy category_budgets_rw on category_budgets
  for all
  using (household_id = current_household())
  with check (household_id = current_household());

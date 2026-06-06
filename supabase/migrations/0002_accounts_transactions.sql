-- 0002 — Accounts and the normalized transaction ledger.
-- `role` is the semantic hook the budgeting engine keys off (main checking
-- drives everything; pool accounts are mirrors). Money is bigint cents,
-- signed: negative = outflow. `dedupe_key` anchors cross-source dedupe.

create table accounts (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references households(id) on delete cascade,
  name             text not null,
  mask             text not null,
  kind             text,
  role             text not null default 'other'
                     check (role in ('main', 'spending_pool', 'savings_pool', 'other')),
  plaid_account_id text,
  created_at       timestamptz not null default now(),
  unique (household_id, mask)
);

create table transactions (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid not null references households(id) on delete cascade,
  account_id           uuid references accounts(id) on delete set null,
  posted_date          date not null,
  description_raw      text not null,
  description_norm     text not null,
  label                text,
  amount_cents         bigint not null,
  running_balance_cents bigint,
  type                 text check (type in ('income', 'expense', 'transfer')),
  category_id          uuid,
  is_transfer          boolean not null default false,
  transfer_group_id    uuid,
  is_savings           boolean not null default false,
  source               text not null check (source in ('pdf', 'manual', 'plaid')),
  source_ref           text,
  dedupe_key           text not null,
  attributed_to        uuid references memberships(id) on delete set null,
  needs_review         boolean not null default false,
  user_overridden      boolean not null default false,
  superseded_by        uuid references transactions(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- One canonical row per economic event (PDF/Plaid for the same event collide
  -- intentionally because the key excludes source).
  unique (household_id, dedupe_key),
  -- A Plaid transaction_id is globally unique within the household.
  unique (household_id, source, source_ref)
);

create index transactions_household_date_idx
  on transactions(household_id, posted_date desc);
create index transactions_account_idx on transactions(account_id);
create index transactions_transfer_group_idx on transactions(transfer_group_id);

-- Keep updated_at honest.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger transactions_set_updated_at
  before update on transactions
  for each row execute function set_updated_at();

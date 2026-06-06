-- 0004 — Savings goals, Plaid item storage, and import batches.

-- Progress is DERIVED from transactions, not stored; this row just holds the
-- target and which accounts count toward it.
create table savings_goals (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid not null references households(id) on delete cascade,
  name                 text not null default 'Savings',
  target_cents         bigint,
  account_id           uuid references accounts(id) on delete set null,
  includes_wealthfront boolean not null default true,
  created_at           timestamptz not null default now()
);

-- Plaid linkage. The access token is sensitive: it is encrypted at rest and
-- only ever read by the service role (see RLS in 0005 — no client policy).
create table plaid_items (
  id                     uuid primary key default gen_random_uuid(),
  household_id           uuid not null references households(id) on delete cascade,
  item_id                text not null unique,
  access_token_encrypted bytea not null,
  institution_id         text,
  cursor                 text,
  status                 text not null default 'active'
                           check (status in ('active', 'login_required', 'error', 'revoked')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger plaid_items_set_updated_at
  before update on plaid_items
  for each row execute function set_updated_at();

-- File-hash idempotency: re-uploading the same statement is a no-op.
create table import_batches (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  source        text not null check (source in ('pdf', 'manual', 'plaid')),
  file_hash     text,
  filename      text,
  row_count     integer not null default 0,
  inserted      integer not null default 0,
  superseded    integer not null default 0,
  skipped       integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (household_id, file_hash)
);

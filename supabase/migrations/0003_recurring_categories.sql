-- 0003 — Categories, the editable label->category map, and recurring items.

create table categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name         text not null,
  icon         text,
  sort_order   smallint not null default 0,
  unique (household_id, name)
);

-- Now that categories exists, wire up the transactions FK.
alter table transactions
  add constraint transactions_category_fk
  foreign key (category_id) references categories(id) on delete set null;

-- Maps a hand-typed statement label (Costco, Dinner, Gas...) to a category so
-- discretionary spend auto-categorizes. Editable by the household.
create table label_category_map (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  label        text not null,
  category_id  uuid not null references categories(id) on delete cascade,
  unique (household_id, label)
);

-- Unified recurring income & bills. Detected from history, then confirmable /
-- overridable by the user. `is_savings` items are excluded from bills upstream.
create table recurring_items (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references households(id) on delete cascade,
  direction             text not null check (direction in ('income', 'bill')),
  name                  text not null,
  match_norm            text not null,
  cadence               text not null
                          check (cadence in ('weekly', 'biweekly', 'monthly', 'irregular')),
  anchor_date           date not null,
  amount_cents          bigint not null,
  amount_source         text not null default 'detected'
                          check (amount_source in ('detected', 'override')),
  detected_amount_cents bigint,
  min_cents             bigint,
  max_cents             bigint,
  account_id            uuid references accounts(id) on delete set null,
  is_active             boolean not null default true,
  is_savings            boolean not null default false,
  auto_detected         boolean not null default true,
  confirmed             boolean not null default false,
  created_at            timestamptz not null default now(),
  unique (household_id, direction, match_norm)
);

create index recurring_items_household_idx on recurring_items(household_id);

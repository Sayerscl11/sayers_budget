-- 0001 — Households, memberships, and the RLS identity helper.
-- A household is the shared budget; both spouses are members of one household
-- and therefore see the same data. Every household-scoped table downstream
-- keys its RLS off current_household().

create extension if not exists "pgcrypto";

create table households (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  timezone      text not null default 'America/New_York',
  week_start_dow smallint not null default 1 check (week_start_dow between 0 and 6),
  created_at    timestamptz not null default now()
);

create table memberships (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role         text not null default 'member' check (role in ('owner', 'member')),
  created_at   timestamptz not null default now(),
  unique (household_id, user_id)
);

create index memberships_user_id_idx on memberships(user_id);

-- Resolve the calling user to their household. SECURITY DEFINER so it can read
-- memberships under RLS; STABLE so the planner can cache it within a statement.
create or replace function current_household()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id
  from memberships
  where user_id = auth.uid()
  limit 1
$$;

alter table households enable row level security;
alter table memberships enable row level security;

create policy households_select on households
  for select using (id = current_household());

create policy memberships_select on memberships
  for select using (household_id = current_household());

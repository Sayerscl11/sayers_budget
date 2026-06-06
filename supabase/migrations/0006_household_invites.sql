-- 0006 — Household invites, so the second spouse can join the SAME household
-- instead of creating their own. The owner records the partner's email during
-- onboarding; on that partner's first sign-in the server (service role) finds
-- the pending invite by email and creates their membership. Invitees have no
-- household yet, so acceptance happens server-side, not under RLS.

create table household_invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  email        text not null,
  display_name text,
  invited_by   uuid references memberships(id) on delete set null,
  accepted     boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (household_id, email)
);

create index household_invites_email_idx on household_invites(lower(email));

alter table household_invites enable row level security;

-- Members can see/manage invites for their own household; acceptance for a
-- not-yet-member is done by the service role (which bypasses RLS).
create policy household_invites_rw on household_invites
  for all
  using (household_id = current_household())
  with check (household_id = current_household());

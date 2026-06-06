-- 0005 — Row-level security. Every household-scoped table is readable/writable
-- only by members of that household, resolved via current_household(). The
-- plaid_items access token is deliberately NOT exposed to authenticated
-- clients — only the service role (which bypasses RLS) reads it.

alter table accounts            enable row level security;
alter table transactions        enable row level security;
alter table categories          enable row level security;
alter table label_category_map  enable row level security;
alter table recurring_items     enable row level security;
alter table savings_goals       enable row level security;
alter table import_batches      enable row level security;
alter table plaid_items         enable row level security;

-- Full CRUD within your own household for the everyday tables.
do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'transactions', 'categories', 'label_category_map',
    'recurring_items', 'savings_goals', 'import_batches'
  ]
  loop
    execute format($f$
      create policy %1$s_rw on %1$I
        for all
        using (household_id = current_household())
        with check (household_id = current_household());
    $f$, t);
  end loop;
end $$;

-- plaid_items: no authenticated policy at all => clients can't read the token.
-- Server-side code uses the service-role key, which bypasses RLS.

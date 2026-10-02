-- 0008 — Subscriptions. Detected from debit-card purchases by the engine; the
-- only thing stored is the household's decision to count one or not, which
-- reuses recurring_items under a third direction (match_norm = the engine's
-- subscription key). Amount and dates are saved for reference only — the live
-- values are always re-derived from transactions.

alter table recurring_items drop constraint recurring_items_direction_check;

alter table recurring_items
  add constraint recurring_items_direction_check
  check (direction in ('income', 'bill', 'subscription'));

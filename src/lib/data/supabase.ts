// Supabase-backed data source. RLS scopes every query to the caller's
// household, so no household_id filter is needed here. Returns the same
// BudgetData shape as the demo source, so the UI is identical either way.

import { createClient } from '../supabase/server';
import { HOUSEHOLD } from '../household';
import {
  dbAccountToRef,
  dbRowToTxn,
  type DbAccountRow,
  type DbTxnRow,
} from '../db/mappers';
import type { BudgetData } from './source';

export async function loadSupabaseData(): Promise<BudgetData> {
  const supabase = await createClient();

  const [{ data: accountRows }, { data: txnRows }, { data: households }] =
    await Promise.all([
      supabase.from('accounts').select('id, mask, name, role'),
      supabase
        .from('transactions')
        .select(
          'id, account_id, posted_date, description_raw, description_norm, label, ' +
            'amount_cents, running_balance_cents, type, is_transfer, ' +
            'transfer_group_id, is_savings, dedupe_key, needs_review',
        )
        // Superseded rows are kept for audit but excluded from the budget view.
        .is('superseded_by', null)
        .order('posted_date', { ascending: true }),
      supabase.from('households').select('timezone, week_start_dow').limit(1),
    ]);

  // Cast through `unknown`: without generated DB types the client returns a
  // loose row shape. (A future `supabase gen types` pass tightens this.)
  const accounts = (accountRows ?? []) as unknown as DbAccountRow[];
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const txns = ((txnRows ?? []) as unknown as DbTxnRow[]).map((r) =>
    dbRowToTxn(r, accountsById),
  );

  const hh = households?.[0];
  const household = hh
    ? { timezone: hh.timezone as string, weekStartDow: hh.week_start_dow as number }
    : HOUSEHOLD;

  // Real deployment uses the actual current date in the household timezone.
  const today = new Date().toLocaleDateString('en-CA', { timeZone: household.timezone });

  return {
    txns,
    accounts: accounts.map(dbAccountToRef),
    household,
    today,
    source: 'supabase',
  };
}

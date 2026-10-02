// Load the household's envelope budgets. In demo mode (no DB) it returns
// history-based suggestions so the envelope view is populated out of the box.

import type { EnvelopeBudget } from '@core/engine';
import { suggestEnvelopes } from '@core/engine';
import { useSupabaseData } from '../env';
import { createClient } from '../supabase/server';
import { loadDemoData } from './demo';

export async function loadEnvelopeBudgets(): Promise<EnvelopeBudget[]> {
  if (!useSupabaseData()) {
    // Demo: synthesize envelopes from the sample spending so the view isn't empty.
    const { txns, accounts } = loadDemoData();
    return suggestEnvelopes(txns, accounts);
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('category_budgets')
    .select('category, monthly_cents, rollover, start_month');

  return ((data ?? []) as unknown as Array<{
    category: string;
    monthly_cents: number | string;
    rollover: boolean;
    start_month: string;
  }>).map((r) => ({
    category: r.category,
    monthlyCents: Number(r.monthly_cents),
    rollover: r.rollover,
    startMonth: r.start_month,
  }));
}

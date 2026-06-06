// Load the household's saved recurring overrides. Returns [] in demo mode (no
// DB), so the dashboard/recurring views fall back to pure detection.

import type { Cadence, RecurringDirection } from '@core/types';
import type { RecurringOverride } from '@core/engine';
import { useSupabaseData } from '../env';
import { createClient } from '../supabase/server';

export async function loadRecurringOverrides(): Promise<RecurringOverride[]> {
  if (!useSupabaseData()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('recurring_items')
    .select(
      'direction, match_norm, cadence, anchor_date, amount_cents, amount_source, is_active, is_savings',
    );

  return ((data ?? []) as unknown as Array<{
    direction: RecurringDirection;
    match_norm: string;
    cadence: Cadence;
    anchor_date: string;
    amount_cents: number | string;
    amount_source: 'detected' | 'override';
    is_active: boolean;
    is_savings: boolean;
  }>).map((r) => ({
    direction: r.direction,
    matchNorm: r.match_norm,
    cadence: r.cadence,
    anchorDate: r.anchor_date,
    amountCents: Number(r.amount_cents),
    amountSource: r.amount_source,
    isActive: r.is_active,
    isSavings: r.is_savings,
  }));
}

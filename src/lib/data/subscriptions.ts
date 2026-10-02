// Load the household's saved subscription decisions (count it / don't). Returns
// [] in demo mode, so the views fall back to pure detection.

import type { SubscriptionOverride } from '@core/engine';
import { useSupabaseData } from '../env';
import { createClient } from '../supabase/server';

export async function loadSubscriptionOverrides(): Promise<SubscriptionOverride[]> {
  if (!useSupabaseData()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('recurring_items')
    .select('match_norm, is_active')
    .eq('direction', 'subscription');

  return ((data ?? []) as unknown as Array<{ match_norm: string; is_active: boolean }>).map(
    (r) => ({ key: r.match_norm, included: r.is_active }),
  );
}

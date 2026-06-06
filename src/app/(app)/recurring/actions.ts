'use server';

import { revalidatePath } from 'next/cache';
import type { Cadence, RecurringDirection } from '@core/types';
import { createClient } from '@/lib/supabase/server';
import { useSupabaseData } from '@/lib/env';
import { getMembershipHousehold } from '@/lib/auth';

export interface SaveRecurringInput {
  direction: RecurringDirection;
  matchNorm: string;
  name: string;
  cadence: Cadence;
  anchorDate: string;
  amountCents: number;
  amountSource: 'detected' | 'override';
  detectedAmountCents: number | null;
  minCents: number | null;
  maxCents: number | null;
  isActive: boolean;
  isSavings: boolean;
}

/**
 * Upsert one recurring item (keyed by household + direction + match_norm). Used
 * for every edit on the Recurring manager: toggling active, overriding an
 * amount, changing cadence, or flagging a contribution as savings.
 */
export async function saveRecurring(input: SaveRecurringInput): Promise<{ error?: string }> {
  if (!useSupabaseData()) return { error: 'Connect Supabase to save changes.' };
  const householdId = await getMembershipHousehold();
  if (!householdId) return { error: 'No household found.' };

  const supabase = await createClient();
  const { error } = await supabase.from('recurring_items').upsert(
    {
      household_id: householdId,
      direction: input.direction,
      match_norm: input.matchNorm,
      name: input.name,
      cadence: input.cadence,
      anchor_date: input.anchorDate,
      amount_cents: input.amountCents,
      amount_source: input.amountSource,
      detected_amount_cents: input.detectedAmountCents,
      min_cents: input.minCents,
      max_cents: input.maxCents,
      is_active: input.isActive,
      is_savings: input.isSavings,
      auto_detected: input.detectedAmountCents != null,
      confirmed: true,
    },
    { onConflict: 'household_id,direction,match_norm' },
  );
  if (error) return { error: error.message };

  revalidatePath('/');
  revalidatePath('/recurring');
  return {};
}

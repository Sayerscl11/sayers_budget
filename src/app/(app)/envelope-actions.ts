'use server';

import { revalidatePath } from 'next/cache';
import { suggestEnvelopes } from '@core/engine';
import { createClient } from '@/lib/supabase/server';
import { useSupabaseData } from '@/lib/env';
import { getMembershipHousehold } from '@/lib/auth';
import { loadBudgetData } from '@/lib/data/source';

export interface SaveEnvelopeInput {
  category: string;
  monthly: string; // dollars, as typed
  startMonth: string; // yyyy-mm
  rollover: boolean;
}

export async function saveEnvelope(input: SaveEnvelopeInput): Promise<{ error?: string }> {
  if (!useSupabaseData()) return { error: 'Connect Supabase to set budgets.' };
  const householdId = await getMembershipHousehold();
  if (!householdId) return { error: 'No household found.' };

  const category = input.category.trim();
  if (!category) return { error: 'Name the category.' };
  const dollars = parseFloat(input.monthly.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(dollars) || dollars < 0) return { error: 'Enter a monthly amount.' };

  const supabase = await createClient();
  const { error } = await supabase.from('category_budgets').upsert(
    {
      household_id: householdId,
      category,
      monthly_cents: Math.round(dollars * 100),
      rollover: input.rollover,
      start_month: input.startMonth,
    },
    { onConflict: 'household_id,category' },
  );
  if (error) return { error: error.message };

  revalidatePath('/');
  return {};
}

export async function deleteEnvelope(category: string): Promise<{ error?: string }> {
  if (!useSupabaseData()) return { error: 'Connect Supabase first.' };
  const householdId = await getMembershipHousehold();
  if (!householdId) return { error: 'No household found.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('category_budgets')
    .delete()
    .eq('household_id', householdId)
    .eq('category', category);
  if (error) return { error: error.message };

  revalidatePath('/');
  return {};
}

/** Seed envelopes from spending history for any category not already budgeted. */
export async function applySuggestedEnvelopes(): Promise<{ error?: string; added?: number }> {
  if (!useSupabaseData()) return { error: 'Connect Supabase first.' };
  const householdId = await getMembershipHousehold();
  if (!householdId) return { error: 'No household found.' };

  const { txns, accounts } = await loadBudgetData();
  const suggestions = suggestEnvelopes(txns, accounts);
  if (suggestions.length === 0) return { added: 0 };

  const supabase = await createClient();
  const { error, count } = await supabase.from('category_budgets').upsert(
    suggestions.map((s) => ({
      household_id: householdId,
      category: s.category,
      monthly_cents: s.monthlyCents,
      rollover: s.rollover,
      start_month: s.startMonth,
    })),
    { onConflict: 'household_id,category', ignoreDuplicates: true, count: 'exact' },
  );
  if (error) return { error: error.message };

  revalidatePath('/');
  return { added: count ?? suggestions.length };
}

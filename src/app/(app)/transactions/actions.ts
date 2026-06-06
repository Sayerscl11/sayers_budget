'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { useSupabaseData } from '@/lib/env';
import { getMembershipHousehold } from '@/lib/auth';

export interface QuickAddInput {
  amount: string; // dollars, as typed
  category: string;
  date: string; // yyyy-mm-dd
  attributedTo?: string | null; // membership id
}

/**
 * Log a discretionary purchase by hand. The household records personal spend as
 * labeled "Withdrawal to Debit Card Account" outflows in checking, so we store
 * it the same way: the engine then counts it as this-week discretionary spend
 * with no special-casing, and a later PDF/Plaid import of the same purchase will
 * fuzzy-supersede this manual row (preserving the category).
 */
export async function addManualTransaction(input: QuickAddInput): Promise<{ error?: string }> {
  if (!useSupabaseData()) return { error: 'Connect Supabase to log spending.' };
  const householdId = await getMembershipHousehold();
  if (!householdId) return { error: 'No household found.' };

  const dollars = parseFloat(input.amount.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(dollars) || dollars <= 0) return { error: 'Enter an amount.' };
  const category = input.category.trim() || 'Spending';

  const supabase = await createClient();

  // Resolve (or lazily create) the main checking account this spend draws from.
  let { data: main } = await supabase
    .from('accounts')
    .select('id')
    .eq('role', 'main')
    .limit(1)
    .maybeSingle();
  if (!main) {
    const { data: created } = await supabase
      .from('accounts')
      .insert({ household_id: householdId, name: 'Checking', mask: '0000', role: 'main' })
      .select('id')
      .single();
    main = created;
  }

  const { error } = await supabase.from('transactions').insert({
    household_id: householdId,
    account_id: main?.id ?? null,
    posted_date: input.date,
    description_raw: `${category} - Withdrawal to Debit Card Account`,
    description_norm: category.toUpperCase(),
    label: category,
    amount_cents: -Math.round(dollars * 100), // outflow
    type: 'expense',
    source: 'manual',
    source_ref: null,
    dedupe_key: `manual:${randomUUID()}`, // each hand entry is its own event
    attributed_to: input.attributedTo || null,
    needs_review: false,
    user_overridden: true,
  });
  if (error) return { error: error.message };

  revalidatePath('/');
  revalidatePath('/transactions');
  return {};
}

/** Set/replace a transaction's category (the household's hand-typed label). */
export async function setTransactionLabel(
  id: string,
  label: string,
): Promise<{ error?: string }> {
  if (!useSupabaseData()) return { error: 'Connect Supabase to categorize.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('transactions')
    .update({ label: label.trim() || null, user_overridden: true })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/');
  revalidatePath('/transactions');
  return {};
}

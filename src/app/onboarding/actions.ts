'use server';

import { redirect } from 'next/navigation';
import { getCurrentUser, getMembershipHousehold } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export interface OnboardingState {
  error?: string;
}

export async function createHousehold(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Guard against a double-submit creating a second household.
  if (await getMembershipHousehold()) redirect('/');

  const householdName = String(formData.get('householdName') ?? '').trim() || 'Our Budget';
  const yourName = String(formData.get('yourName') ?? '').trim() || 'Me';
  const partnerEmail = String(formData.get('partnerEmail') ?? '').trim().toLowerCase();
  const partnerName = String(formData.get('partnerName') ?? '').trim();

  // No INSERT policies on households/memberships (RLS read-only), so creation
  // runs as the service role, tied to the authenticated user's own id.
  const admin = createAdminClient();
  const { data: hh, error: hhErr } = await admin
    .from('households')
    .insert({ name: householdName, timezone: 'America/New_York', week_start_dow: 1 })
    .select('id')
    .single();
  if (hhErr || !hh) return { error: hhErr?.message ?? 'Could not create household.' };

  const { error: memErr } = await admin.from('memberships').insert({
    household_id: hh.id,
    user_id: user.id,
    display_name: yourName,
    role: 'owner',
  });
  if (memErr) return { error: memErr.message };

  if (partnerEmail) {
    await admin.from('household_invites').insert({
      household_id: hh.id,
      email: partnerEmail,
      display_name: partnerName || null,
    });
  }

  redirect('/');
}

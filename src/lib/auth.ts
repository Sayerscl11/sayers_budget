// Server-side auth/household resolution. The RLS client can read the caller's
// own membership (current_household() is SECURITY DEFINER, so the policy
// `household_id = current_household()` matches their own row). Creating a
// household, or attaching a freshly-signed-up spouse via an invite, needs the
// service-role admin client because there are no INSERT policies and the
// invitee has no household yet.

import type { User } from '@supabase/supabase-js';
import { createClient } from './supabase/server';
import { createAdminClient } from './supabase/admin';

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The signed-in user's household id, or null if they still need onboarding. */
export async function getMembershipHousehold(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('memberships').select('household_id').limit(1).maybeSingle();
  return (data?.household_id as string | undefined) ?? null;
}

/**
 * Resolve the user to a household, accepting a pending email invite if one
 * exists (this is how the second spouse joins). Returns null when the user has
 * neither a membership nor an invite — i.e. they need to create a household.
 */
export async function ensureHousehold(user: User): Promise<string | null> {
  const existing = await getMembershipHousehold();
  if (existing) return existing;
  if (!user.email) return null;

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from('household_invites')
    .select('id, household_id, display_name')
    .ilike('email', user.email)
    .eq('accepted', false)
    .limit(1)
    .maybeSingle();
  if (!invite) return null;

  await admin.from('memberships').insert({
    household_id: invite.household_id,
    user_id: user.id,
    display_name: invite.display_name ?? user.email,
    role: 'member',
  });
  await admin.from('household_invites').update({ accepted: true }).eq('id', invite.id);
  return invite.household_id as string;
}

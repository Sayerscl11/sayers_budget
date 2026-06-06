// Household members, for spend attribution ("who"). Empty in demo mode.

import { useSupabaseData } from '../env';
import { createClient } from '../supabase/server';

export interface Member {
  id: string;
  name: string;
}

export async function loadMembers(): Promise<Member[]> {
  if (!useSupabaseData()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from('memberships').select('id, display_name');
  return ((data ?? []) as unknown as Array<{ id: string; display_name: string }>).map((m) => ({
    id: m.id,
    name: m.display_name,
  }));
}

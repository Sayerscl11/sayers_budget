// Service-role ("secret key") Supabase client. Bypasses RLS, so it is the ONLY
// way to read service-role-only data (the encrypted Plaid access token) and to
// apply ingest plans across a household. SERVER-ONLY: it reads SUPABASE_SECRET_KEY
// (a non-public env var), so it cannot function in — and must never be imported
// into — browser code.

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { publicEnv, serverSecretKey } from '../env';

export function createAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = publicEnv();
  return createSupabaseClient(NEXT_PUBLIC_SUPABASE_URL, serverSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

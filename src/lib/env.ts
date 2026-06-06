// Zod-validated environment. Public values are safe in the browser (the
// publishable key is RLS-scoped); the secret key is server-only and used by the
// admin client for privileged work (reading encrypted Plaid tokens, applying
// ingest plans). Validation is lazy and non-throwing at import time so the
// no-database demo build keeps working without any Supabase config.

import { z } from 'zod';

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  // Newer Supabase "publishable" key (sb_publishable_...); fall back to the
  // legacy anon key name if a project still uses it.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

function readPublic() {
  return publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

/** True when the public Supabase config is present and well-formed. */
export function isSupabaseConfigured(): boolean {
  return readPublic().success;
}

/** Public Supabase config; throws if called when not configured. */
export function publicEnv() {
  const parsed = readPublic();
  if (!parsed.success) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.',
    );
  }
  return parsed.data;
}

/** Whether to read live data from Supabase. Defaults to the demo source until
 *  the project has migrations applied + a seeded household. Opt in explicitly. */
export function useSupabaseData(): boolean {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === 'supabase' && isSupabaseConfigured();
}

/** Server-only secret key for the admin client. Never sent to the browser. */
export function serverSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SECRET_KEY is required for server-side admin operations.');
  }
  return key;
}

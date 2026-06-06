// Refreshes the Supabase auth session on every request and rewrites the cookie
// onto the response, so Server Components always see a fresh session. Called
// from the root `middleware.ts`. No-ops when Supabase isn't configured (the
// demo build runs without auth).

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, publicEnv } from '../env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) return response;

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = publicEnv();
  const supabase = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touch the user to trigger a token refresh when needed. Do not branch app
  // logic here — protect routes in the (app) layout/server components instead.
  // Never let an auth/network hiccup 500 every route: refresh is best-effort.
  try {
    await supabase.auth.getUser();
  } catch {
    /* keep serving with the existing (possibly stale) session */
  }
  return response;
}

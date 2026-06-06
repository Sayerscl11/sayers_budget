import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { BottomNav } from '@/components/nav/BottomNav';
import { loadBudgetData } from '@/lib/data/source';
import { useSupabaseData } from '@/lib/env';
import { getCurrentUser, ensureHousehold } from '@/lib/auth';
import { signOut } from '../(auth)/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Auth only gates the live app; the demo source stays open so the dashboard
  // works with no database. In Supabase mode, require a signed-in user with a
  // household (else send them to login / onboarding).
  const live = useSupabaseData();
  if (live) {
    const user = await getCurrentUser();
    if (!user) redirect('/login');
    const household = await ensureHousehold(user);
    if (!household) redirect('/onboarding');
  }

  const { source } = await loadBudgetData();

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-slate-50">
      {source === 'demo' && (
        <div className="bg-amber-100 px-4 py-1.5 text-center text-[11px] font-medium text-amber-900">
          Demo data — running on sanitized sample statements. Connect Supabase to go live.
        </div>
      )}
      {live && (
        <div className="flex items-center justify-end px-4 py-1.5">
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-600"
            >
              <LogOut size={13} /> Sign out
            </button>
          </form>
        </div>
      )}
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}

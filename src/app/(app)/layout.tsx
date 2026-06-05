import { BottomNav } from '@/components/nav/BottomNav';
import { loadBudgetData } from '@/lib/data/source';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { source } = await loadBudgetData();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-slate-50">
      {source === 'demo' && (
        <div className="bg-amber-100 px-4 py-1.5 text-center text-[11px] font-medium text-amber-900">
          Demo data — running on sanitized sample statements. Connect Supabase to go live.
        </div>
      )}
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}

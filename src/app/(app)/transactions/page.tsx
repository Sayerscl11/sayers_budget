import { withBuckets } from '@core/engine';
import { formatCurrency } from '@core/money';
import { loadBudgetData } from '@/lib/data/source';
import { loadMembers } from '@/lib/data/members';
import { useSupabaseData } from '@/lib/env';
import { QuickAdd } from './QuickAdd';
import { CategoryTag } from './CategoryTag';

export const dynamic = 'force-dynamic';

const BUCKET_LABEL: Record<string, string> = {
  income: 'Income',
  bill: 'Bill',
  discretionary: 'Spending',
  savings: 'Savings',
  transfer: 'Transfer',
};

function dayHeading(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function TransactionsPage() {
  const [{ txns, accounts, today }, members] = await Promise.all([
    loadBudgetData(),
    loadMembers(),
  ]);
  const live = useSupabaseData();

  // Show the household's checking-side ledger; pool "mirror" rows are noise.
  const rows = withBuckets(txns, accounts)
    .filter((t) => t.bucket !== 'mirror')
    .sort((a, b) => (a.postedDate < b.postedDate ? 1 : -1));

  const byDay = new Map<string, typeof rows>();
  for (const t of rows) {
    (byDay.get(t.postedDate) ?? byDay.set(t.postedDate, []).get(t.postedDate)!).push(t);
  }

  return (
    <div className="px-4 py-6">
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Activity</h1>
      {rows.length === 0 ? (
        <p className="rounded-xl bg-white p-4 text-sm text-slate-400 ring-1 ring-slate-100">
          No transactions yet. {live ? 'Tap + to log one, or import a statement.' : 'Import a statement to get started.'}
        </p>
      ) : (
        <div className="space-y-5">
          {[...byDay.entries()].map(([day, items]) => (
            <section key={day}>
              <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {dayHeading(day)}
              </h2>
              <ul className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-100">
                {items.map((t) => {
                  const out = t.amountCents < 0;
                  const discretionary = t.bucket === 'discretionary';
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-800">
                          {t.label || t.descriptionNorm || t.descriptionRaw}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          {discretionary ? (
                            <CategoryTag id={t.id} label={t.label ?? null} editable={live} />
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {BUCKET_LABEL[t.bucket] ?? t.bucket}
                            </span>
                          )}
                          {t.needsReview && (
                            <span className="rounded bg-amber-100 px-1.5 text-[10px] font-medium text-amber-800">
                              review
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-sm font-medium tabular-nums ${
                          out ? 'text-slate-900' : 'text-emerald-600'
                        }`}
                      >
                        {out ? '' : '+'}
                        {formatCurrency(t.amountCents)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {live && <QuickAdd members={members} today={today} />}
    </div>
  );
}

import { savingsProgress } from '@core/engine';
import { formatCurrency } from '@core/money';
import { loadBudgetData } from '@/lib/data/source';

export const dynamic = 'force-dynamic';

function monthLabel(ym: string): string {
  return new Date(ym + '-01T00:00:00Z').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function SavingsPage() {
  const { txns, accounts } = await loadBudgetData();
  const progress = savingsProgress(txns, accounts);
  const months = [...progress.byMonth].reverse();

  return (
    <div className="px-4 py-6">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Savings</h1>
      <p className="mb-5 text-xs text-slate-400">
        Money moved to Performance Savings and Wealthfront. This is a goal you’re
        building — it never reduces your weekly safe-to-spend.
      </p>

      <section className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
        <p className="text-sm font-medium text-slate-500">Total saved</p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-emerald-600">
          {formatCurrency(progress.contributedCents, { showCents: false })}
        </p>
        <p className="mt-1 text-xs text-slate-400">{progress.count} contributions</p>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">By month</h2>
        {months.length === 0 ? (
          <p className="px-1 text-sm text-slate-400">No contributions yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-100">
            {months.map((m) => (
              <li key={m.month} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-slate-700">{monthLabel(m.month)}</span>
                <span className="text-sm font-medium text-slate-900">
                  {formatCurrency(m.cents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

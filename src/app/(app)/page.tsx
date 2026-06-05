import { forecast } from '@core/engine';
import { formatCurrency } from '@core/money';
import { loadBudgetData } from '@/lib/data/source';
import { WeeklyProgress } from '@/components/dashboard/WeeklyProgress';
import { BreakdownSheet } from '@/components/dashboard/BreakdownSheet';

// Always recompute from the latest data.
export const dynamic = 'force-dynamic';

function prettyRange(start: string, end: string): string {
  const fmt = (iso: string) =>
    new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default async function DashboardPage() {
  const { txns, accounts, household, today } = await loadBudgetData();
  const f = forecast({ txns, accounts, household, today });
  const { perWeekCents, weekly, safeToSpend, savings, week } = f;

  return (
    <div className="px-4 py-6">
      <header className="mb-1 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-slate-900">This week</h1>
        <span className="text-xs text-slate-400">{prettyRange(week.start, week.end)}</span>
      </header>

      {/* Hero: the one number. */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <p className="text-center text-sm font-medium text-slate-500">Safe to spend</p>
        <p className="mt-1 text-center text-5xl font-bold tracking-tight text-brand">
          {formatCurrency(perWeekCents, { showCents: false })}
          <span className="text-xl font-semibold text-slate-400"> /wk</span>
        </p>

        <div className="mt-6">
          <WeeklyProgress spentCents={weekly.spentCents} perWeekCents={perWeekCents} />
        </div>

        <BreakdownSheet
          incomeCents={safeToSpend.incomeCents}
          billsCents={safeToSpend.billsCents}
          netCents={safeToSpend.netCents}
          weeks={safeToSpend.weeks}
        />
      </section>

      {/* This week's spend, by the household's own labels. */}
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Spent this week</h2>
        {weekly.byCategory.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-400 ring-1 ring-slate-100">
            Nothing logged yet this week.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-100">
            {weekly.byCategory.map((c) => (
              <li key={c.category} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-slate-700">
                  {c.category}
                  <span className="ml-2 text-xs text-slate-400">
                    {c.count} {c.count === 1 ? 'item' : 'items'}
                  </span>
                </span>
                <span className="text-sm font-medium text-slate-900">
                  {formatCurrency(c.spentCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Savings — explicitly separate from the weekly number. */}
      <section className="mt-5 rounded-xl bg-white p-4 ring-1 ring-slate-100">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Saved so far</h2>
          <span className="text-sm font-semibold text-emerald-600">
            {formatCurrency(savings.contributedCents, { showCents: false })}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Across {savings.count} contributions. Doesn’t reduce your weekly number.
        </p>
      </section>
    </div>
  );
}

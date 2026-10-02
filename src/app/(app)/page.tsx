import {
  forecast,
  detectRecurring,
  buildRecurringRows,
  rowsToForecastItems,
  envelopeStatuses,
  monthlySpendByCategory,
} from '@core/engine';
import { formatCurrency } from '@core/money';
import { loadBudgetData } from '@/lib/data/source';
import { loadRecurringOverrides } from '@/lib/data/recurring';
import { loadEnvelopeBudgets } from '@/lib/data/envelopes';
import { useSupabaseData } from '@/lib/env';
import { BreakdownSheet } from '@/components/dashboard/BreakdownSheet';
import { EnvelopeCard } from './EnvelopeCard';
import { EnvelopeAdder } from './EnvelopeAdder';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [{ txns, accounts, household, today }, overrides, budgets] = await Promise.all([
    loadBudgetData(),
    loadRecurringOverrides(),
    loadEnvelopeBudgets(),
  ]);
  const live = useSupabaseData();
  const month = today.slice(0, 7);
  const monthName = new Date(today + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  // Weekly "pace" number (the top strip), honoring confirmed recurring items.
  const recurringItems = rowsToForecastItems(
    buildRecurringRows(detectRecurring(txns, accounts), overrides),
  );
  const f = forecast({ txns, accounts, household, today, recurringItems });
  const monthlyAvailableCents = Math.round((f.perWeekCents * 52) / 12);

  // Envelopes for this month.
  const statuses = envelopeStatuses(txns, accounts, budgets, month);
  const cards = budgets
    .map((b, i) => ({ budget: b, status: statuses[i] }))
    .sort(
      (a, b) =>
        Number(b.status.overspent) - Number(a.status.overspent) ||
        a.status.remainingCents - b.status.remainingCents,
    );
  const totalRemaining = statuses.reduce((s, e) => s + e.remainingCents, 0);
  const totalSpent = statuses.reduce((s, e) => s + e.spentThisMonthCents, 0);

  const budgeted = new Set(budgets.map((b) => b.category));
  const unbudgeted = monthlySpendByCategory(txns, accounts, month).filter(
    (s) => !budgeted.has(s.category),
  );

  return (
    <div className="px-4 py-6">
      <header className="mb-3 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-slate-900">{monthName}</h1>
      </header>

      {/* Weekly pace strip — the "am I on track" number above the envelopes. */}
      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Safe to spend</p>
            <p className="text-3xl font-bold tracking-tight text-brand">
              {formatCurrency(f.perWeekCents, { showCents: false })}
              <span className="text-base font-semibold text-slate-400">/wk</span>
            </p>
          </div>
          <p className="pb-1 text-right text-xs text-slate-400">
            ≈ {formatCurrency(monthlyAvailableCents, { showCents: false })}/mo
            <br />
            to spend
          </p>
        </div>
        <BreakdownSheet
          incomeCents={f.safeToSpend.incomeCents}
          billsCents={f.safeToSpend.billsCents}
          netCents={f.safeToSpend.netCents}
          weeks={f.safeToSpend.weeks}
        />
      </section>

      {/* Envelopes — the main view. */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-slate-700">This month’s budget</h2>
          {cards.length > 0 && (
            <span className={`text-sm font-semibold ${totalRemaining < 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {formatCurrency(totalRemaining, { showCents: false })} left
            </span>
          )}
        </div>

        {cards.length === 0 ? (
          <p className="mb-3 rounded-xl bg-white p-4 text-sm text-slate-400 ring-1 ring-slate-100">
            No category budgets yet. {live ? 'Add one below, or let the app suggest budgets from your spending.' : 'Connect Supabase to set your own.'}
          </p>
        ) : (
          <div className="space-y-2.5">
            {cards.map(({ budget, status }) => (
              <EnvelopeCard
                key={status.category}
                status={status}
                startMonth={budget.startMonth}
                editable={live}
              />
            ))}
            <p className="px-1 pt-1 text-[11px] text-slate-400">
              {formatCurrency(totalSpent)} spent across your envelopes this month.
            </p>
          </div>
        )}
      </section>

      {live && (
        <section className="mt-4">
          <EnvelopeAdder startMonth={month} unbudgeted={unbudgeted} />
        </section>
      )}

      {!live && unbudgeted.length > 0 && (
        <p className="mt-4 text-center text-[11px] text-slate-400">
          Demo budgets are suggested from the sample spending.
        </p>
      )}
    </div>
  );
}

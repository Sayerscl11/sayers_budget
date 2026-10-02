import {
  detectRecurring,
  buildRecurringRows,
  detectSubscriptions,
  subscriptionMonthlyCents,
  type RecurringRow,
} from '@core/engine';
import { formatCurrency } from '@core/money';
import { loadBudgetData } from '@/lib/data/source';
import { loadRecurringOverrides } from '@/lib/data/recurring';
import { useSupabaseData } from '@/lib/env';
import { loadSubscriptionOverrides } from '@/lib/data/subscriptions';
import { RecurringItemRow } from './RecurringItemRow';
import { SubscriptionRow } from './SubscriptionRow';

export const dynamic = 'force-dynamic';

function Section({
  title, accent, rows, editable,
}: {
  title: string; accent: string; rows: RecurringRow[]; editable: boolean;
}) {
  return (
    <section className="mb-6">
      <h2 className={`mb-2 text-sm font-semibold ${accent}`}>{title}</h2>
      {rows.length === 0 ? (
        <p className="px-1 text-sm text-slate-400">None detected yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-100">
          {rows.map((r) => (
            <RecurringItemRow key={`${r.direction}:${r.matchNorm}`} row={r} editable={editable} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function RecurringPage() {
  const [{ txns, accounts }, overrides, subOverrides] = await Promise.all([
    loadBudgetData(),
    loadRecurringOverrides(),
    loadSubscriptionOverrides(),
  ]);
  const subs = detectSubscriptions(txns, subOverrides);
  const editable = useSupabaseData();
  const rows = buildRecurringRows(detectRecurring(txns, accounts), overrides);

  // Active items first, then by amount, within each direction.
  const sortRows = (a: RecurringRow, b: RecurringRow) =>
    Number(b.isActive) - Number(a.isActive) || b.amountCents - a.amountCents;
  const income = rows.filter((r) => r.direction === 'income').sort(sortRows);
  const bills = rows.filter((r) => r.direction === 'bill').sort(sortRows);

  return (
    <div className="px-4 py-6">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Recurring</h1>
      <p className="mb-5 text-xs text-slate-400">
        {editable
          ? 'Toggle items in or out of your forecast, fix an amount, or change how often they repeat. Changes update your weekly number instantly.'
          : 'Auto-detected from your statement history. Connect Supabase to confirm and edit these.'}
      </p>

      <Section title="Income" accent="text-emerald-700" rows={income} editable={editable} />
      <Section title="Bills" accent="text-slate-700" rows={bills} editable={editable} />

      <section id="subscriptions" className="mb-6 scroll-mt-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Subscriptions</h2>
          {subs.length > 0 && (
            <span className="text-sm font-semibold tabular-nums text-slate-900">
              {formatCurrency(subscriptionMonthlyCents(subs))}
              <span className="font-normal text-slate-400">/mo</span>
            </span>
          )}
        </div>
        {subs.length === 0 ? (
          <p className="px-1 text-sm text-slate-400">
            None found yet. They show up once the same charge has hit your debit card two
            months running.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-100">
              {subs.map((s) => (
                <SubscriptionRow key={s.key} sub={s} editable={editable} />
              ))}
            </ul>
            <p className="px-1 pt-2 text-[11px] text-slate-400">
              Found on your debit card: the same charge, about once a month. Switched-on
              ones are set aside before your weekly number.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

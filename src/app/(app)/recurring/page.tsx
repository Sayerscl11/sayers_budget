import { detectRecurring, type RecurringCandidate } from '@core/engine';
import { formatCurrency } from '@core/money';
import { loadBudgetData } from '@/lib/data/source';

export const dynamic = 'force-dynamic';

const CADENCE_LABEL: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  irregular: 'Irregular',
};

function Item({ r }: { r: RecurringCandidate }) {
  const varies = r.minCents !== r.maxCents;
  return (
    <li className="flex items-center justify-between px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{r.name}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          {CADENCE_LABEL[r.cadence] ?? r.cadence} · {r.occurrences}×
          {!r.regular && ' · one-off'}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-slate-900">
          {formatCurrency(r.detectedAmountCents)}
        </p>
        {varies && (
          <p className="text-[10px] text-slate-400">
            {formatCurrency(r.minCents, { showCents: false })}–
            {formatCurrency(r.maxCents, { showCents: false })}
          </p>
        )}
      </div>
    </li>
  );
}

function List({ items }: { items: RecurringCandidate[] }) {
  if (items.length === 0) {
    return <p className="px-1 text-sm text-slate-400">None detected yet.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-100">
      {items.map((r) => (
        <Item key={`${r.direction}:${r.matchNorm}`} r={r} />
      ))}
    </ul>
  );
}

export default async function RecurringPage() {
  const { txns, accounts } = await loadBudgetData();
  const recurring = detectRecurring(txns, accounts);
  const income = recurring.filter((r) => r.direction === 'income');
  const bills = recurring.filter((r) => r.direction === 'bill');

  return (
    <div className="px-4 py-6">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Recurring</h1>
      <p className="mb-5 text-xs text-slate-400">
        Auto-detected from your statement history. Steady income drives the weekly
        number; one-off deposits are flagged so they don’t inflate it.
      </p>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-emerald-700">Income</h2>
        <List items={income} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Bills</h2>
        <List items={bills} />
      </section>
    </div>
  );
}

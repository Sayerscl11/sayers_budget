import { detectRecurring, buildRecurringRows, type RecurringRow } from '@core/engine';
import { loadBudgetData } from '@/lib/data/source';
import { loadRecurringOverrides } from '@/lib/data/recurring';
import { useSupabaseData } from '@/lib/env';
import { RecurringItemRow } from './RecurringItemRow';

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
  const [{ txns, accounts }, overrides] = await Promise.all([
    loadBudgetData(),
    loadRecurringOverrides(),
  ]);
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
    </div>
  );
}

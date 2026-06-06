'use client';

import { useState, useTransition } from 'react';
import { Loader2, Pencil, Check } from 'lucide-react';
import type { Cadence } from '@core/types';
import type { RecurringRow } from '@core/engine';
import { formatCurrency } from '@core/money';
import { saveRecurring } from './actions';

const CADENCE_LABEL: Record<Cadence, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  irregular: 'Irregular',
};

export function RecurringItemRow({ row, editable }: { row: RecurringRow; editable: boolean }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState((row.amountCents / 100).toFixed(2));
  const [cadence, setCadence] = useState<Cadence>(row.cadence);
  const [isSavings, setIsSavings] = useState(row.isSavings);

  const varies = row.minCents != null && row.maxCents != null && row.minCents !== row.maxCents;

  function persist(patch: Partial<Pick<RecurringRow, 'isActive' | 'amountCents' | 'cadence' | 'isSavings'>>) {
    const amountCents = patch.amountCents ?? row.amountCents;
    startTransition(async () => {
      await saveRecurring({
        direction: row.direction,
        matchNorm: row.matchNorm,
        name: row.name,
        cadence: patch.cadence ?? row.cadence,
        anchorDate: row.anchorDate,
        amountCents,
        amountSource: amountCents !== row.detectedAmountCents ? 'override' : 'detected',
        detectedAmountCents: row.detectedAmountCents,
        minCents: row.minCents,
        maxCents: row.maxCents,
        isActive: patch.isActive ?? row.isActive,
        isSavings: patch.isSavings ?? row.isSavings,
      });
    });
  }

  function saveEdit() {
    const cents = Math.round(parseFloat(amount.replace(/[^0-9.]/g, '')) * 100);
    persist({ amountCents: Number.isFinite(cents) ? cents : row.amountCents, cadence, isSavings });
    setEditing(false);
  }

  return (
    <li className={`px-4 py-3 ${row.isActive ? '' : 'opacity-50'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">
            {row.name}
            {row.amountSource === 'override' && (
              <span className="ml-1.5 text-[10px] font-normal text-brand">edited</span>
            )}
            {row.isSavings && (
              <span className="ml-1.5 rounded bg-emerald-100 px-1.5 text-[10px] text-emerald-700">
                savings
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {CADENCE_LABEL[row.cadence]}
            {row.occurrences > 0 && <> · {row.occurrences}×</>}
            {varies && (
              <> · {formatCurrency(row.minCents!, { showCents: false })}–{formatCurrency(row.maxCents!, { showCents: false })}</>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-slate-900">
            {formatCurrency(row.amountCents)}
          </span>
          {editable && (
            <>
              <button
                onClick={() => setEditing((e) => !e)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Edit"
              >
                {pending ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}
              </button>
              {/* Include / exclude from the forecast. */}
              <button
                onClick={() => persist({ isActive: !row.isActive })}
                disabled={pending}
                className={`flex h-5 w-9 items-center rounded-full px-0.5 transition-colors ${
                  row.isActive ? 'justify-end bg-brand' : 'justify-start bg-slate-300'
                }`}
                aria-label={row.isActive ? 'Active' : 'Inactive'}
              >
                <span className="h-4 w-4 rounded-full bg-white" />
              </button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Amount $</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="w-28 rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand"
            />
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as Cadence)}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand"
            >
              {(['weekly', 'biweekly', 'monthly', 'irregular'] as Cadence[]).map((c) => (
                <option key={c} value={c}>{CADENCE_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={isSavings}
              onChange={(e) => setIsSavings(e.target.checked)}
            />
            This is a savings contribution (don’t subtract from safe-to-spend)
          </label>
          <button
            onClick={saveEdit}
            disabled={pending}
            className="flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            <Check size={13} /> Save
          </button>
        </div>
      )}
    </li>
  );
}

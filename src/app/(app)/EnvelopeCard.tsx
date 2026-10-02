'use client';

import { useState, useTransition } from 'react';
import { Pencil, Loader2, Trash2 } from 'lucide-react';
import type { EnvelopeStatus } from '@core/engine';
import { formatCurrency } from '@core/money';
import { saveEnvelope, deleteEnvelope } from './envelope-actions';

export function EnvelopeCard({
  status,
  startMonth,
  editable,
}: {
  status: EnvelopeStatus;
  startMonth: string;
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState((status.monthlyCents / 100).toFixed(0));
  const [rollover, setRollover] = useState(status.rollover);

  const spent = status.spentThisMonthCents;
  const available = status.availableCents;
  const pct = available > 0 ? Math.min(100, Math.round((spent / available) * 100)) : spent > 0 ? 100 : 0;
  const barColor = status.overspent
    ? 'bg-red-500'
    : status.remainingCents <= available * 0.2
      ? 'bg-amber-500'
      : 'bg-brand';

  function save() {
    startTransition(async () => {
      await saveEnvelope({ category: status.category, monthly: amount, startMonth, rollover });
      setEditing(false);
    });
  }
  function remove() {
    startTransition(async () => {
      await deleteEnvelope(status.category);
    });
  }

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-800">{status.category}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {formatCurrency(spent)} of {formatCurrency(available)} this month
            {status.rollover && <span className="ml-1 text-emerald-600">· rolls over</span>}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold tabular-nums ${status.overspent ? 'text-red-600' : 'text-slate-900'}`}>
            {status.overspent ? `-${formatCurrency(-status.remainingCents, { showCents: false })}` : formatCurrency(status.remainingCents, { showCents: false })}
          </p>
          <p className="text-[10px] text-slate-400">{status.overspent ? 'over' : 'left'}</p>
        </div>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>

      {editable && (
        <div className="mt-2 flex items-center justify-end">
          <button
            onClick={() => setEditing((e) => !e)}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
          >
            {pending ? <Loader2 size={12} className="animate-spin" /> : <Pencil size={12} />}
            Edit budget
          </button>
        </div>
      )}

      {editing && (
        <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Monthly $</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={rollover} onChange={(e) => setRollover(e.target.checked)} />
            Roll unspent money into next month
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={pending}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              Save
            </button>
            <button
              onClick={remove}
              disabled={pending}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-red-500 hover:bg-red-50"
            >
              <Trash2 size={12} /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

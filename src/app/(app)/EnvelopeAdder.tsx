'use client';

import { useState, useTransition } from 'react';
import { Plus, Sparkles, Loader2 } from 'lucide-react';
import { formatCurrency } from '@core/money';
import { saveEnvelope, applySuggestedEnvelopes } from './envelope-actions';

/** Add a new envelope, pre-fillable from an unbudgeted category, plus a
 *  one-tap "suggest budgets from my spending" action. */
export function EnvelopeAdder({
  startMonth,
  unbudgeted,
}: {
  startMonth: string;
  unbudgeted: { category: string; spentCents: number }[];
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');

  function add(cat: string, amt: string) {
    if (!cat.trim() || !amt.trim()) return;
    startTransition(async () => {
      await saveEnvelope({ category: cat.trim(), monthly: amt, startMonth, rollover: true });
      setOpen(false);
      setCategory('');
      setAmount('');
    });
  }

  return (
    <div className="space-y-3">
      {unbudgeted.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-3">
          <p className="mb-2 text-xs font-medium text-amber-800">
            Spending with no budget yet
          </p>
          <div className="space-y-1.5">
            {unbudgeted.map((u) => (
              <div key={u.category} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  {u.category}
                  <span className="ml-2 text-xs text-slate-400">
                    {formatCurrency(u.spentCents)} this month
                  </span>
                </span>
                <button
                  onClick={() => {
                    setCategory(u.category);
                    setAmount(Math.max(10, Math.round(u.spentCents / 100)).toString());
                    setOpen(true);
                  }}
                  className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-brand ring-1 ring-brand/30"
                >
                  Set budget
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200"
        >
          <Plus size={16} /> Add category
        </button>
        <button
          onClick={() => startTransition(async () => { await applySuggestedEnvelopes(); })}
          disabled={pending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand/10 py-2.5 text-sm font-medium text-brand disabled:opacity-40"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Suggest from history
        </button>
      </div>

      {open && (
        <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-slate-100">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category (e.g. Groceries)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">$</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="Monthly budget"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button
              onClick={() => add(category, amount)}
              disabled={pending}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

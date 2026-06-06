'use client';

import { useState, useTransition } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import type { Member } from '@/lib/data/members';
import { addManualTransaction } from './actions';

const SUGGESTIONS = ['Dinner', 'Gas', 'Groceries', 'Coffee', 'Costco', 'Diapers'];

export function QuickAdd({ members, today }: { members: Member[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(today);
  const [who, setWho] = useState('');

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await addManualTransaction({
        amount,
        category,
        date,
        attributedTo: who || null,
      });
      if (res.error) setError(res.error);
      else {
        setOpen(false);
        setAmount('');
        setCategory('');
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 active:scale-95"
        aria-label="Add a purchase"
      >
        <Plus size={26} />
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Log a purchase</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3">
                <span className="text-lg font-semibold text-slate-400">$</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  autoFocus
                  placeholder="0.00"
                  className="w-full text-lg font-semibold outline-none"
                />
              </div>

              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Category (e.g. Dinner)"
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-brand"
              />
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setCategory(s)}
                    className={`rounded-full px-3 py-1 text-xs ${
                      category === s ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                />
                {members.length > 0 && (
                  <select
                    value={who}
                    onChange={(e) => setWho(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                  >
                    <option value="">Who?</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                onClick={submit}
                disabled={pending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {pending && <Loader2 size={16} className="animate-spin" />}
                Add purchase
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatCurrency } from '@core/money';

/** The tappable "why this number" disclosure under the hero figure. */
export function BreakdownSheet({
  incomeCents,
  billsCents,
  subscriptionsCents = 0,
  netCents,
  weeks,
}: {
  incomeCents: number;
  /** All projected bills for the period, subscriptions included. */
  billsCents: number;
  /** The subscriptions share of `billsCents`, shown on its own line. */
  subscriptionsCents?: number;
  netCents: number;
  weeks: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-center gap-1 text-sm font-medium text-slate-500"
      >
        Why this number
        <ChevronDown
          size={16}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <dl className="mt-3 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
          <Row label="Recurring income" value={formatCurrency(incomeCents)} />
          <Row
            label="Recurring bills"
            value={`−${formatCurrency(billsCents - subscriptionsCents)}`}
          />
          {subscriptionsCents > 0 && (
            <Row label="Subscriptions" value={`−${formatCurrency(subscriptionsCents)}`} />
          )}
          <Row label="Net for the period" value={formatCurrency(netCents)} strong />
          <Row label="÷ weeks in period" value={weeks.toFixed(2)} />
          <p className="pt-1 text-xs text-slate-400">
            Savings is tracked separately and is not subtracted here.
          </p>
        </dl>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={strong ? 'font-semibold text-slate-900' : 'text-slate-700'}>{value}</dd>
    </div>
  );
}

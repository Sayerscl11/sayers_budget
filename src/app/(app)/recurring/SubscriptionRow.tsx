'use client';

import { useState, useTransition } from 'react';
import type { Subscription } from '@core/engine';
import { formatCurrency } from '@core/money';
import { saveSubscription } from './actions';

function shortDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function SubscriptionRow({ sub, editable }: { sub: Subscription; editable: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await saveSubscription({
        key: sub.key,
        name: sub.name,
        amountCents: sub.amountCents,
        lastDate: sub.lastDate,
        included: !sub.included,
      });
      if (res.error) setError(res.error);
    });
  }

  return (
    <li className={`px-4 py-3 ${sub.included ? '' : 'opacity-50'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{sub.name}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {sub.current ? (
              <>Monthly · last {shortDate(sub.lastDate)} · next {shortDate(sub.nextDate)}</>
            ) : (
              <>No charge since {shortDate(sub.lastDate)} · looks cancelled</>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-slate-900">
            {formatCurrency(sub.amountCents)}
          </span>
          {editable && (
            <button
              onClick={toggle}
              disabled={pending}
              className={`flex h-5 w-9 items-center rounded-full px-0.5 transition-colors disabled:opacity-60 ${
                sub.included ? 'justify-end bg-brand' : 'justify-start bg-slate-300'
              }`}
              aria-label={sub.included ? `Stop counting ${sub.name}` : `Count ${sub.name}`}
              aria-pressed={sub.included}
            >
              <span className="h-4 w-4 rounded-full bg-white" />
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </li>
  );
}

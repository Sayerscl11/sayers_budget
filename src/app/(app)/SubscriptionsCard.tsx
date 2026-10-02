import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { SubscriptionMonth } from '@core/engine';
import { formatCurrency } from '@core/money';

function shortDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Home summary of the money already committed to subscriptions this month. */
export function SubscriptionsCard({ month }: { month: SubscriptionMonth }) {
  const next = month.upcoming[0];
  const pct =
    month.monthlyCents > 0
      ? Math.min(100, Math.round((month.chargedCents / month.monthlyCents) * 100))
      : 0;

  return (
    <Link
      href="/recurring#subscriptions"
      className="mb-4 block rounded-xl bg-white p-4 ring-1 ring-slate-100"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-800">Subscriptions</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {month.count} set aside · {formatCurrency(month.chargedCents)} charged so far
          </p>
        </div>
        <div className="flex items-center gap-1 text-right">
          <div>
            <p className="text-lg font-bold tabular-nums text-slate-900">
              {formatCurrency(month.monthlyCents)}
            </p>
            <p className="text-[10px] text-slate-400">per month</p>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </div>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-slate-500" style={{ width: `${pct}%` }} />
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        {next ? (
          <>
            Next: {next.name} {formatCurrency(next.amountCents)} around {shortDate(next.dueDate)}
            {month.upcoming.length > 1 && <> · {month.upcoming.length - 1} more this month</>}
          </>
        ) : (
          <>All charged for this month.</>
        )}
      </p>
    </Link>
  );
}

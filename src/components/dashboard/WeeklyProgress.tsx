import { formatCurrency } from '@core/money';

/**
 * The depleting weekly bar: green while there's comfortable room, amber as it
 * runs low, red once overspent. Mirrors how the household thinks about "how
 * much is left this week".
 */
export function WeeklyProgress({
  spentCents,
  perWeekCents,
}: {
  spentCents: number;
  perWeekCents: number;
}) {
  const remaining = perWeekCents - spentCents;
  const pct =
    perWeekCents > 0 ? Math.min(100, Math.round((spentCents / perWeekCents) * 100)) : 0;
  const over = remaining < 0;
  const low = !over && remaining <= perWeekCents * 0.2;
  const barColor = over ? 'bg-red-500' : low ? 'bg-amber-500' : 'bg-brand';

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="text-slate-500">{formatCurrency(spentCents)} spent</span>
        <span className={over ? 'font-semibold text-red-600' : 'text-slate-500'}>
          {over
            ? `${formatCurrency(-remaining)} over`
            : `${formatCurrency(remaining)} left`}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${over ? 100 : pct}%` }}
        />
      </div>
    </div>
  );
}

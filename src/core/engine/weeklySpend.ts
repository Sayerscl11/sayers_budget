// Discretionary spend-so-far against the weekly safe-to-spend number. This is
// the figure that "auto-adjusts as you log spending": it sums the household's
// labeled debit-card funding (their personal spend) within the current week.

import type { AccountRef, DateRange, Txn } from '../types';
import { isWithin } from '../dates';
import { budgetBucket } from './classify';

export interface CategorySpend {
  category: string;
  spentCents: number;
  count: number;
}

export interface WeeklySpend {
  spentCents: number;
  remainingCents: number;
  perWeekCents: number;
  byCategory: CategorySpend[];
}

const UNCATEGORIZED = 'Uncategorized';

export function weeklySpendSoFar(
  txns: Txn[],
  accounts: AccountRef[],
  week: DateRange,
  perWeekCents: number,
): WeeklySpend {
  const byCat = new Map<string, CategorySpend>();
  let spentCents = 0;

  for (const t of txns) {
    if (!isWithin(t.postedDate, week)) continue;
    if (budgetBucket(t, accounts) !== 'discretionary') continue;
    const amt = Math.abs(t.amountCents);
    spentCents += amt;
    const category = (t.label?.trim() || UNCATEGORIZED);
    const entry = byCat.get(category) ?? { category, spentCents: 0, count: 0 };
    entry.spentCents += amt;
    entry.count += 1;
    byCat.set(category, entry);
  }

  return {
    spentCents,
    remainingCents: perWeekCents - spentCents,
    perWeekCents,
    byCategory: [...byCat.values()].sort((a, b) => b.spentCents - a.spentCents),
  };
}

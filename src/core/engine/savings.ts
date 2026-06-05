// Savings goal progress, derived from transactions (money moved to the savings
// pool + Wealthfront). Tracked separately and never subtracted from
// safe-to-spend, per the household's choice.

import type { AccountRef, DateRange, Txn } from '../types';
import { isWithin } from '../dates';
import { budgetBucket } from './classify';

export interface SavingsProgress {
  contributedCents: number;
  count: number;
  byMonth: Array<{ month: string; cents: number }>;
}

export function savingsProgress(
  txns: Txn[],
  accounts: AccountRef[],
  range?: DateRange,
): SavingsProgress {
  const byMonth = new Map<string, number>();
  let contributedCents = 0;
  let count = 0;

  for (const t of txns) {
    if (range && !isWithin(t.postedDate, range)) continue;
    if (budgetBucket(t, accounts) !== 'savings') continue;
    const amt = Math.abs(t.amountCents);
    contributedCents += amt;
    count += 1;
    const month = t.postedDate.slice(0, 7); // yyyy-mm
    byMonth.set(month, (byMonth.get(month) ?? 0) + amt);
  }

  return {
    contributedCents,
    count,
    byMonth: [...byMonth.entries()]
      .map(([month, cents]) => ({ month, cents }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}

// Category "envelope" budgeting — the household's real mental model: a monthly
// cap per discretionary category (Groceries, Gas, Misc…) with the spend drawn
// down against it. This is a lens over the same discretionary spend the rest of
// the engine already classifies; it never touches income/bills/savings.
//
// Rollover (the household's choice): unspent money carries forward. The tidy
// consequence is that, with rollover, this month's remaining is simply
//   (cap × months since the envelope started) − (total spent since it started)
// so a frugal month genuinely banks room for a splurge later.

import type { AccountRef, Txn } from '../types';
import { monthKey, monthDiff } from '../dates';
import { budgetBucket } from './classify';

export interface EnvelopeBudget {
  /** Matches the transaction label (the household's hand-typed category). */
  category: string;
  monthlyCents: number;
  rollover: boolean;
  /** `yyyy-mm` the envelope began accumulating. */
  startMonth: string;
}

export interface EnvelopeStatus {
  category: string;
  monthlyCents: number;
  spentThisMonthCents: number;
  /** What's spendable this month: the cap plus any carried-over balance. */
  availableCents: number;
  remainingCents: number;
  rollover: boolean;
  overspent: boolean;
}

export interface MonthlyCategorySpend {
  category: string;
  spentCents: number;
}

const UNCATEGORIZED = 'Uncategorized';

/** Discretionary spend grouped by category, then by `yyyy-mm`. */
function spendByCategoryMonth(
  txns: Txn[],
  accounts: AccountRef[],
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const t of txns) {
    if (budgetBucket(t, accounts) !== 'discretionary') continue;
    const cat = t.label?.trim() || UNCATEGORIZED;
    const ym = monthKey(t.postedDate);
    const byMonth = out.get(cat) ?? out.set(cat, new Map()).get(cat)!;
    byMonth.set(ym, (byMonth.get(ym) ?? 0) + Math.abs(t.amountCents));
  }
  return out;
}

export function envelopeStatuses(
  txns: Txn[],
  accounts: AccountRef[],
  budgets: EnvelopeBudget[],
  month: string, // yyyy-mm "this month"
): EnvelopeStatus[] {
  const spend = spendByCategoryMonth(txns, accounts);

  return budgets.map((b) => {
    const byMonth = spend.get(b.category) ?? new Map<string, number>();
    const spentThisMonth = byMonth.get(month) ?? 0;

    let availableCents: number;
    const monthsElapsed = monthDiff(b.startMonth, month) + 1; // inclusive of this month

    if (b.rollover && monthsElapsed > 0) {
      // Total budgeted through this month, minus everything spent before it.
      let spentBefore = 0;
      for (const [ym, cents] of byMonth) {
        if (ym >= b.startMonth && ym < month) spentBefore += cents;
      }
      availableCents = b.monthlyCents * monthsElapsed - spentBefore;
    } else {
      availableCents = b.monthlyCents; // no rollover: a fresh cap each month
    }

    const remainingCents = availableCents - spentThisMonth;
    return {
      category: b.category,
      monthlyCents: b.monthlyCents,
      spentThisMonthCents: spentThisMonth,
      availableCents,
      remainingCents,
      rollover: b.rollover,
      overspent: remainingCents < 0,
    };
  });
}

/** Every category with discretionary spend in `month` (budgeted or not). */
export function monthlySpendByCategory(
  txns: Txn[],
  accounts: AccountRef[],
  month: string,
): MonthlyCategorySpend[] {
  const spend = spendByCategoryMonth(txns, accounts);
  const out: MonthlyCategorySpend[] = [];
  for (const [category, byMonth] of spend) {
    const spentCents = byMonth.get(month) ?? 0;
    if (spentCents > 0) out.push({ category, spentCents });
  }
  return out.sort((a, b) => b.spentCents - a.spentCents);
}

/**
 * Suggest envelope caps from history: each category's average monthly spend,
 * rounded to the nearest $10 (min $10). Powers the "auto-suggest budgets"
 * action and the demo view.
 */
export function suggestEnvelopes(txns: Txn[], accounts: AccountRef[]): EnvelopeBudget[] {
  const spend = spendByCategoryMonth(txns, accounts);
  const out: EnvelopeBudget[] = [];
  for (const [category, byMonth] of spend) {
    const months = [...byMonth.keys()].sort();
    // Only recurring spend deserves an envelope; one-off purchases (a single
    // month) are left unbudgeted so they surface as "set a budget?" nudges.
    if (months.length < 2) continue;
    const total = [...byMonth.values()].reduce((a, b) => a + b, 0);
    const avg = total / months.length;
    const rounded = Math.max(1000, Math.round(avg / 1000) * 1000);
    out.push({ category, monthlyCents: rounded, rollover: true, startMonth: months[0] });
  }
  return out.sort((a, b) => b.monthlyCents - a.monthlyCents);
}

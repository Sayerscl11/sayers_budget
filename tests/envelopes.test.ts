import { describe, it, expect } from 'vitest';
import type { AccountRef, Txn } from '../src/core/types';
import {
  envelopeStatuses,
  monthlySpendByCategory,
  suggestEnvelopes,
  type EnvelopeBudget,
} from '../src/core/engine';

const accounts: AccountRef[] = [{ mask: '4333', name: '360 Checking', role: 'main' }];

// A discretionary spend is a labeled "Withdrawal to Debit Card Account" outflow
// in checking — exactly how the household (and the engine) records personal spend.
let seq = 0;
function spend(label: string, date: string, dollars: number): Txn {
  return {
    id: `t${seq++}`,
    accountMask: '4333',
    accountRole: 'main',
    postedDate: date,
    descriptionRaw: `${label} - Withdrawal to Debit Card Account`,
    descriptionNorm: label.toUpperCase(),
    label,
    amountCents: -Math.round(dollars * 100),
  };
}

describe('envelopeStatuses', () => {
  it('no rollover: remaining is just cap minus this month spend', () => {
    const txns = [spend('Groceries', '2026-10-05', 63), spend('Groceries', '2026-10-09', 40)];
    const budgets: EnvelopeBudget[] = [
      { category: 'Groceries', monthlyCents: 60000, rollover: false, startMonth: '2026-10' },
    ];
    const [g] = envelopeStatuses(txns, accounts, budgets, '2026-10');
    expect(g.spentThisMonthCents).toBe(10300);
    expect(g.availableCents).toBe(60000);
    expect(g.remainingCents).toBe(60000 - 10300);
    expect(g.overspent).toBe(false);
  });

  it('rollover: unspent last month increases this month available', () => {
    // Sep: cap 600, spent 400 -> 200 banked. Oct: cap 600 + 200 = 800 available.
    const txns = [spend('Groceries', '2026-09-10', 400), spend('Groceries', '2026-10-03', 150)];
    const budgets: EnvelopeBudget[] = [
      { category: 'Groceries', monthlyCents: 60000, rollover: true, startMonth: '2026-09' },
    ];
    const [g] = envelopeStatuses(txns, accounts, budgets, '2026-10');
    expect(g.availableCents).toBe(80000); // 600*2 - 400 spent before Oct
    expect(g.spentThisMonthCents).toBe(15000);
    expect(g.remainingCents).toBe(65000); // 800 - 150
  });

  it('rollover remaining == total budgeted minus total spent since start', () => {
    const txns = [
      spend('Gas', '2026-08-01', 100),
      spend('Gas', '2026-09-01', 120),
      spend('Gas', '2026-10-01', 90),
    ];
    const budgets: EnvelopeBudget[] = [
      { category: 'Gas', monthlyCents: 14000, rollover: true, startMonth: '2026-08' },
    ];
    const [g] = envelopeStatuses(txns, accounts, budgets, '2026-10');
    // 140*3 budgeted - (100+120+90) spent = 420 - 310 = 110
    expect(g.remainingCents).toBe(11000);
  });

  it('flags overspend when this month runs past available', () => {
    const txns = [spend('Misc', '2026-10-02', 500)];
    const budgets: EnvelopeBudget[] = [
      { category: 'Misc', monthlyCents: 40000, rollover: true, startMonth: '2026-10' },
    ];
    const [m] = envelopeStatuses(txns, accounts, budgets, '2026-10');
    expect(m.remainingCents).toBe(-10000);
    expect(m.overspent).toBe(true);
  });
});

describe('monthlySpendByCategory', () => {
  it('sums discretionary spend by label for the month, ignoring other months', () => {
    const txns = [
      spend('Groceries', '2026-10-05', 63),
      spend('Gas', '2026-10-06', 40),
      spend('Groceries', '2026-09-30', 999), // different month
    ];
    const got = monthlySpendByCategory(txns, accounts, '2026-10');
    expect(got).toEqual([
      { category: 'Groceries', spentCents: 6300 },
      { category: 'Gas', spentCents: 4000 },
    ]);
  });
});

describe('suggestEnvelopes', () => {
  it('suggests the average monthly spend per category, rounded to $10', () => {
    const txns = [
      spend('Groceries', '2026-09-01', 500),
      spend('Groceries', '2026-10-01', 540), // avg 520 -> 520.00
    ];
    const [g] = suggestEnvelopes(txns, accounts);
    expect(g.category).toBe('Groceries');
    expect(g.monthlyCents).toBe(52000);
    expect(g.rollover).toBe(true);
    expect(g.startMonth).toBe('2026-09');
  });
});

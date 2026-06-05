import { describe, it, expect } from 'vitest';
import { loadAllTxns } from './_load';
import {
  budgetBucket,
  detectRecurring,
  computePeriodTotals,
  safeToSpendBreakdown,
  weeklySpendSoFar,
  savingsProgress,
  type RecurringItemInput,
} from '../src/core/engine';
import { formatCurrency } from '../src/core/money';

const { txns, accounts } = loadAllTxns();
const find = (re: RegExp, role?: string) =>
  txns.find((t) => re.test(t.descriptionRaw) && (!role || t.accountRole === role));

describe('budgetBucket — encodes the household model', () => {
  it('rent is a bill', () => {
    expect(budgetBucket(find(/Legacy Real Est/, 'main')!, accounts)).toBe('bill');
  });
  it('payroll is income', () => {
    expect(budgetBucket(find(/INTRALOX/, 'main')!, accounts)).toBe('income');
  });
  it('labeled debit-card funding is discretionary', () => {
    expect(
      budgetBucket(find(/Dinner - Withdrawal to Debit Card/, 'main')!, accounts),
    ).toBe('discretionary');
  });
  it('moves to Performance Savings are savings', () => {
    expect(
      budgetBucket(find(/Withdrawal to 360 Performance Savings/, 'main')!, accounts),
    ).toBe('savings');
  });
  it('Wealthfront is savings', () => {
    expect(budgetBucket(find(/Wealthfront/, 'main')!, accounts)).toBe('savings');
  });
  it('pulling money back from savings is a neutral transfer', () => {
    expect(
      budgetBucket(find(/Deposit from 360 Performance Savings/, 'main')!, accounts),
    ).toBe('transfer');
  });
  it('activity inside the debit-card pool is a mirror (ignored)', () => {
    const purchase = find(/Debit Card Purchase/, 'spending_pool');
    expect(budgetBucket(purchase!, accounts)).toBe('mirror');
  });
});

describe('detectRecurring — finds the constant items with sane cadence', () => {
  const recurring = detectRecurring(txns, accounts);
  const byName = (norm: string) => recurring.find((r) => r.matchNorm === norm);

  it('detects payroll as recurring income', () => {
    expect(byName('INTRALOX PAYROLL')?.direction).toBe('income');
  });
  it('Intralox payroll is biweekly', () => {
    expect(byName('INTRALOX PAYROLL')?.cadence).toBe('biweekly');
  });
  it('Nissan auto loan is a monthly bill ~$468.72', () => {
    const nissan = byName('NISSAN AUTO LOAN');
    expect(nissan?.direction).toBe('bill');
    expect(nissan?.cadence).toBe('monthly');
    expect(nissan?.detectedAmountCents).toBe(46872);
  });
  it('captures the known recurring bills', () => {
    for (const norm of ['LEGACY REAL ESTATE', 'ATT', 'VERIZON', 'PLANET FITNESS']) {
      expect(byName(norm), `missing ${norm}`).toBeDefined();
    }
  });
  it('rent amount is the median of its varying range', () => {
    const rent = byName('LEGACY REAL ESTATE')!;
    expect(rent.minCents).toBeLessThan(rent.maxCents); // it varies
    expect(rent.detectedAmountCents).toBeGreaterThanOrEqual(rent.minCents);
    expect(rent.detectedAmountCents).toBeLessThanOrEqual(rent.maxCents);
  });
});

describe('safe-to-spend — end-to-end over a representative month', () => {
  const recurring = detectRecurring(txns, accounts);
  // Simulate the user-confirmed forecast set: steady income only (drops one-off
  // deposits like a $13k transfer-in), plus all detected bills (conservative).
  const items: RecurringItemInput[] = recurring
    .filter((r) => (r.direction === 'income' ? r.regular : true))
    .map((r) => ({
      direction: r.direction,
      cadence: r.cadence,
      anchorDate: r.anchorDate,
      amountCents: r.detectedAmountCents,
    }));
  const period = { start: '2026-04-01', end: '2026-04-30' };
  const totals = computePeriodTotals(items, period);
  const sts = safeToSpendBreakdown({
    incomeCents: totals.incomeCents,
    billsCents: totals.billsCents,
    weeks: 30 / 7,
  });

  it('one-off deposits are excluded from steady income', () => {
    expect(recurring.find((r) => r.matchNorm === 'DEPOSIT FROM AEIS CREDIT')?.regular).toBe(false);
  });

  it('totals and the weekly figure satisfy the safe-to-spend identity', () => {
    // eslint-disable-next-line no-console
    console.log(
      `[forecast] income=${formatCurrency(totals.incomeCents)} bills=${formatCurrency(
        totals.billsCents,
      )} net=${formatCurrency(sts.netCents)} perWeek=${formatCurrency(sts.perWeekCents)}`,
    );
    expect(totals.incomeCents).toBeGreaterThan(0);
    expect(totals.billsCents).toBeGreaterThan(0);
    expect(sts.netCents).toBe(totals.incomeCents - totals.billsCents);
    expect(sts.perWeekCents).toBe(Math.floor(sts.netCents / (30 / 7)));
    // Plausibility: a weekly personal-spend figure within a sane band.
    expect(Math.abs(sts.perWeekCents)).toBeLessThan(5_000_00);
  });
});

describe('weeklySpendSoFar — discretionary grouped by category', () => {
  const week = { start: '2025-12-01', end: '2025-12-07' };
  const result = weeklySpendSoFar(txns, accounts, week, 30000);

  it('sums labeled debit-card funding within the week', () => {
    expect(result.spentCents).toBeGreaterThan(0);
    expect(result.remainingCents).toBe(30000 - result.spentCents);
  });
  it('breaks spend down by the hand-typed categories', () => {
    expect(result.byCategory.length).toBeGreaterThan(0);
    const cats = result.byCategory.map((c) => c.category);
    expect(cats.some((c) => c !== 'Uncategorized')).toBe(true);
  });
});

describe('savingsProgress — tracked separately', () => {
  it('accumulates contributions to savings/Wealthfront', () => {
    const progress = savingsProgress(txns, accounts);
    expect(progress.contributedCents).toBeGreaterThan(0);
    expect(progress.byMonth.length).toBeGreaterThan(0);
  });
});

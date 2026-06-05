import { describe, it, expect } from 'vitest';
import { loadAllTxns } from './_load';
import { forecast, defaultForecastItems, detectRecurring } from '../src/core/engine';
import type { HouseholdConfig } from '../src/core/types';

const { txns, accounts } = loadAllTxns();
const household: HouseholdConfig = { timezone: 'America/New_York', weekStartDow: 1 };

describe('forecast — the dashboard backbone over 5 real statements', () => {
  // A "today" inside the statement window so the current week has real data.
  const result = forecast({ txns, accounts, household, today: '2025-12-03' });

  it('produces a realistic weekly safe-to-spend number', () => {
    // The end-to-end engine test reconciles ~$243/week; the orchestrator must
    // land in the same sane band (positive, under a few hundred a week).
    expect(result.perWeekCents).toBeGreaterThan(0);
    expect(result.perWeekCents).toBeLessThan(1_000_00);
  });

  it('satisfies the safe-to-spend identity', () => {
    const { incomeCents, billsCents, netCents, perWeekCents, weeks } = result.safeToSpend;
    expect(netCents).toBe(incomeCents - billsCents);
    expect(perWeekCents).toBe(Math.floor(netCents / weeks));
  });

  it('defaults the forecast window to the month containing today', () => {
    expect(result.period).toEqual({ start: '2025-12-01', end: '2025-12-31' });
  });

  it('reports the current household week (Mon-start) for today', () => {
    // 2025-12-03 is a Wednesday; Monday-started week is Dec 1..Dec 7.
    expect(result.week).toEqual({ start: '2025-12-01', end: '2025-12-07' });
  });

  it('tracks discretionary spend-so-far against the weekly number', () => {
    expect(result.weekly.perWeekCents).toBe(result.perWeekCents);
    expect(result.weekly.remainingCents).toBe(
      result.perWeekCents - result.weekly.spentCents,
    );
    expect(result.weekly.spentCents).toBeGreaterThan(0); // real spend that week
  });

  it('surfaces savings progress without touching safe-to-spend', () => {
    expect(result.savings.contributedCents).toBeGreaterThan(0);
  });

  it('exposes detected recurring candidates for the Recurring screen', () => {
    expect(result.recurring.some((r) => r.matchNorm === 'INTRALOX PAYROLL')).toBe(true);
  });

  it('honors a caller-supplied recurring override', () => {
    // Force an empty forecast set => zero income/bills => zero per-week.
    const empty = forecast({
      txns,
      accounts,
      household,
      today: '2025-12-03',
      recurringItems: [],
    });
    expect(empty.safeToSpend.incomeCents).toBe(0);
    expect(empty.safeToSpend.billsCents).toBe(0);
    expect(empty.perWeekCents).toBe(0);
  });

  it('defaultForecastItems drops one-off income but keeps bills', () => {
    const recurring = detectRecurring(txns, accounts);
    const items = defaultForecastItems(recurring);
    const oneOff = recurring.find((r) => r.matchNorm === 'DEPOSIT FROM AEIS CREDIT');
    expect(oneOff?.regular).toBe(false);
    // No income item should carry the one-off's exact anchor+amount signature.
    const leaked = items.some(
      (i) =>
        i.direction === 'income' &&
        oneOff != null &&
        i.amountCents === oneOff.detectedAmountCents &&
        i.anchorDate === oneOff.anchorDate,
    );
    expect(leaked).toBe(false);
  });
});

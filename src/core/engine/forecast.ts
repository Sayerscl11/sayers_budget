// The dashboard backbone: one pure function that turns a household's
// transactions + config into the complete "safe-to-spend" view-model the UI
// renders. Everything stateful (DB reads, "what is today") is resolved by the
// caller and passed in, keeping this deterministic and unit-testable.

import type { AccountRef, DateRange, HouseholdConfig, Txn } from '../types';
import { monthRangeContaining, weekRangeContaining, weeksInPeriod } from '../dates';
import { detectRecurring, type RecurringCandidate } from './recurring';
import { computePeriodTotals, type RecurringItemInput } from './period';
import { safeToSpendBreakdown, type SafeToSpendBreakdown } from './safeToSpend';
import { weeklySpendSoFar, type WeeklySpend } from './weeklySpend';
import { savingsProgress, type SavingsProgress } from './savings';

export interface ForecastInput {
  txns: Txn[];
  accounts: AccountRef[];
  household: HouseholdConfig;
  /** Today's date as ISO `yyyy-mm-dd`, resolved in the household timezone by
   *  the adapter (never `Date.now()` inside the engine). */
  today: string;
  /** Forecast window for projecting recurring income/bills. Defaults to the
   *  calendar month containing `today`. */
  period?: DateRange;
  /** User-confirmed recurring items. When omitted, a sensible default set is
   *  derived from detection (steady income only + all detected bills). */
  recurringItems?: RecurringItemInput[];
}

export interface DashboardForecast {
  /** The headline number: free-to-spend per week. */
  perWeekCents: number;
  safeToSpend: SafeToSpendBreakdown;
  /** Current household week [start, end]. */
  week: DateRange;
  /** Spend-so-far this week vs. the weekly number. */
  weekly: WeeklySpend;
  savings: SavingsProgress;
  /** All detected recurring candidates (for the Recurring screen). */
  recurring: RecurringCandidate[];
  /** The forecast window actually used. */
  period: DateRange;
}

/**
 * Default forecast set when the user hasn't confirmed one yet: take steady
 * income (drop one-off lumps like a large transfer-in) plus every detected
 * bill, each at its robust median amount. Mirrors the acceptance scenario.
 */
export function defaultForecastItems(
  recurring: RecurringCandidate[],
): RecurringItemInput[] {
  return recurring
    .filter((r) => (r.direction === 'income' ? r.regular : true))
    .map((r) => ({
      direction: r.direction,
      cadence: r.cadence,
      anchorDate: r.anchorDate,
      amountCents: r.detectedAmountCents,
    }));
}

export function forecast(input: ForecastInput): DashboardForecast {
  const { txns, accounts, household, today } = input;
  const weekStartDow = household.weekStartDow;

  const period = input.period ?? monthRangeContaining(today);
  const recurring = detectRecurring(txns, accounts);
  const items = input.recurringItems ?? defaultForecastItems(recurring);

  const totals = computePeriodTotals(items, period);
  const safeToSpend = safeToSpendBreakdown({
    incomeCents: totals.incomeCents,
    billsCents: totals.billsCents,
    weeks: weeksInPeriod(period, weekStartDow, 'fractional'),
  });

  const week = weekRangeContaining(today, weekStartDow);
  const weekly = weeklySpendSoFar(txns, accounts, week, safeToSpend.perWeekCents);
  const savings = savingsProgress(txns, accounts);

  return {
    perWeekCents: safeToSpend.perWeekCents,
    safeToSpend,
    week,
    weekly,
    savings,
    recurring,
    period,
  };
}

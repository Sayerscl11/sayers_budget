// Project recurring items across a forecast period and total income vs bills.
// Savings-flagged items are intentionally NOT included in bills (the household
// tracks savings as a separate goal, so it does not reduce safe-to-spend).

import type { Cadence, DateRange, RecurringDirection } from '../types';
import { countCadenceOccurrences } from '../dates';

export interface RecurringItemInput {
  direction: RecurringDirection;
  cadence: Cadence;
  anchorDate: string;
  /** Absolute per-occurrence amount in cents. */
  amountCents: number;
  isActive?: boolean;
  /** When true, excluded from bills (a savings contribution). */
  isSavings?: boolean;
}

export interface PeriodTotals {
  incomeCents: number;
  billsCents: number;
  savingsCents: number;
}

export function computePeriodTotals(
  items: RecurringItemInput[],
  range: DateRange,
): PeriodTotals {
  let incomeCents = 0;
  let billsCents = 0;
  let savingsCents = 0;
  for (const item of items) {
    if (item.isActive === false) continue;
    const occ = countCadenceOccurrences(item.cadence as Cadence, item.anchorDate, range);
    const total = occ * item.amountCents;
    if (item.isSavings) savingsCents += total;
    else if (item.direction === 'income') incomeCents += total;
    else billsCents += total;
  }
  return { incomeCents, billsCents, savingsCents };
}

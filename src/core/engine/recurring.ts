// Detect constant recurring income & bills from history. Operates only on the
// income/bill buckets (discretionary is variable and savings is a separate
// goal), groups by the normalized merchant stem, and infers cadence + a robust
// (median) amount with the observed range.

import type { AccountRef, Cadence, RecurringDirection, Txn } from '../types';
import { medianCents } from '../money';
import { inferCadence, medianGapDays } from '../dates';
import { budgetBucket } from './classify';

export interface RecurringCandidate {
  direction: RecurringDirection;
  /** Suggested display name (derived from the normalized stem). */
  name: string;
  matchNorm: string;
  cadence: Cadence;
  /** Latest occurrence, used as the projection anchor. */
  anchorDate: string;
  /** Robust per-occurrence amount in cents (absolute value). */
  detectedAmountCents: number;
  /** Observed min/max (absolute cents) so the UI can show "varies". */
  minCents: number;
  maxCents: number;
  occurrences: number;
  sampleTxnIds: string[];
  /** Steady enough to drive a forecast by default (regular cadence). One-off or
   *  lumpy deposits (e.g. a large transfer-in) are flagged false so the UI can
   *  exclude them from income without hiding them. */
  regular: boolean;
}

const MIN_OCCURRENCES = 2;

export function detectRecurring(
  txns: Txn[],
  accounts: AccountRef[],
): RecurringCandidate[] {
  const groups = new Map<string, Txn[]>();
  for (const t of txns) {
    const bucket = budgetBucket(t, accounts);
    if (bucket !== 'income' && bucket !== 'bill') continue;
    const key = `${bucket}::${t.descriptionNorm}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(t);
  }

  const candidates: RecurringCandidate[] = [];
  for (const [key, group] of groups) {
    if (group.length < MIN_OCCURRENCES) continue;
    const [bucket] = key.split('::') as [RecurringDirection];
    const dates = group.map((t) => t.postedDate).sort();
    const amounts = group.map((t) => Math.abs(t.amountCents));
    const cadence = inferCadence(medianGapDays(dates));
    candidates.push({
      direction: bucket,
      name: titleCase(group[0].descriptionNorm),
      matchNorm: group[0].descriptionNorm,
      cadence,
      anchorDate: dates[dates.length - 1],
      detectedAmountCents: medianCents(amounts),
      minCents: Math.min(...amounts),
      maxCents: Math.max(...amounts),
      occurrences: group.length,
      sampleTxnIds: group.map((t) => t.id),
      regular: cadence !== 'irregular' && group.length >= 3,
    });
  }

  // Most frequent / largest first — the items that matter most to the forecast.
  return candidates.sort(
    (a, b) =>
      b.occurrences - a.occurrences ||
      b.detectedAmountCents - a.detectedAmountCents,
  );
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

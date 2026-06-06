// Merge auto-detected recurring candidates with the user's saved overrides into
// one view (for the Recurring manager) and one forecast input list (for the
// engine). Pure: the persistence layer supplies plain `RecurringOverride`
// objects. With zero overrides this reproduces `defaultForecastItems` exactly —
// so confirming/editing items only ever refines the same baseline number.

import type { Cadence, RecurringDirection } from '../types';
import type { RecurringCandidate } from './recurring';
import type { RecurringItemInput } from './period';

/** A user's saved decision about a recurring item (one row in recurring_items). */
export interface RecurringOverride {
  direction: RecurringDirection;
  matchNorm: string;
  isActive: boolean;
  isSavings: boolean;
  cadence: Cadence;
  anchorDate: string;
  /** Effective per-occurrence amount in cents (absolute). */
  amountCents: number;
  amountSource: 'detected' | 'override';
}

/** One row in the Recurring manager: detection facts + effective settings. */
export interface RecurringRow {
  direction: RecurringDirection;
  matchNorm: string;
  name: string;
  cadence: Cadence;
  anchorDate: string;
  /** Effective amount used by the forecast (override wins over detected). */
  amountCents: number;
  detectedAmountCents: number | null;
  minCents: number | null;
  maxCents: number | null;
  occurrences: number;
  isActive: boolean;
  isSavings: boolean;
  amountSource: 'detected' | 'override';
  /** Whether the user has saved a decision for this item. */
  confirmed: boolean;
}

const key = (direction: RecurringDirection, matchNorm: string) => `${direction}::${matchNorm}`;

/** Default include state for an unconfirmed candidate — mirrors defaultForecastItems. */
function defaultActive(c: RecurringCandidate): boolean {
  return c.direction === 'income' ? c.regular : true;
}

export function buildRecurringRows(
  detected: RecurringCandidate[],
  overrides: RecurringOverride[],
): RecurringRow[] {
  const ov = new Map(overrides.map((o) => [key(o.direction, o.matchNorm), o]));
  const rows: RecurringRow[] = [];
  const seen = new Set<string>();

  for (const c of detected) {
    const k = key(c.direction, c.matchNorm);
    seen.add(k);
    const o = ov.get(k);
    rows.push({
      direction: c.direction,
      matchNorm: c.matchNorm,
      name: c.name,
      cadence: o?.cadence ?? c.cadence,
      anchorDate: o?.anchorDate ?? c.anchorDate,
      amountCents: o ? o.amountCents : c.detectedAmountCents,
      detectedAmountCents: c.detectedAmountCents,
      minCents: c.minCents,
      maxCents: c.maxCents,
      occurrences: c.occurrences,
      isActive: o ? o.isActive : defaultActive(c),
      isSavings: o ? o.isSavings : false,
      amountSource: o?.amountSource ?? 'detected',
      confirmed: !!o,
    });
  }

  // Saved items no longer present in detection (e.g. a manually added bill, or a
  // merchant that dropped out of the recent window) still drive the forecast.
  for (const o of overrides) {
    const k = key(o.direction, o.matchNorm);
    if (seen.has(k)) continue;
    rows.push({
      direction: o.direction,
      matchNorm: o.matchNorm,
      name: titleCase(o.matchNorm),
      cadence: o.cadence,
      anchorDate: o.anchorDate,
      amountCents: o.amountCents,
      detectedAmountCents: null,
      minCents: null,
      maxCents: null,
      occurrences: 0,
      isActive: o.isActive,
      isSavings: o.isSavings,
      amountSource: o.amountSource,
      confirmed: true,
    });
  }

  return rows;
}

/** The active rows, as forecast inputs. */
export function rowsToForecastItems(rows: RecurringRow[]): RecurringItemInput[] {
  return rows
    .filter((r) => r.isActive)
    .map((r) => ({
      direction: r.direction,
      cadence: r.cadence,
      anchorDate: r.anchorDate,
      amountCents: r.amountCents,
      isSavings: r.isSavings,
    }));
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

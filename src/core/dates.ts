// Pure calendar-date math on ISO `yyyy-mm-dd` strings. We deliberately avoid
// time-of-day and timezones here: callers compute "today" in the household
// timezone (adapter layer) and pass an ISO date in. This keeps week math
// deterministic and trivially testable.

import type { Cadence, DateRange } from './types';

const MS_PER_DAY = 86_400_000;

/** Parse `yyyy-mm-dd` into a UTC-midnight Date (no tz drift). */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Format a UTC Date as `yyyy-mm-dd`. */
export function formatISO(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Add (or subtract) whole days to an ISO date. */
export function addDays(iso: string, days: number): string {
  return formatISO(new Date(parseISO(iso).getTime() + days * MS_PER_DAY));
}

/** Add (or subtract) whole months, clamping the day-of-month (Jan 31 -> Feb 28). */
export function addMonths(iso: string, months: number): string {
  const dt = parseISO(iso);
  const day = dt.getUTCDate();
  const target = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return formatISO(target);
}

/** Whole-day difference b - a (can be negative). */
export function daysBetween(aIso: string, bIso: string): number {
  return Math.round((parseISO(bIso).getTime() - parseISO(aIso).getTime()) / MS_PER_DAY);
}

/** Inclusive day count of a range, e.g. Jan 1..Jan 31 => 31. */
export function daysInclusive(range: DateRange): number {
  return daysBetween(range.start, range.end) + 1;
}

/** Start of the budgeting week containing `iso`, given weekStartDow (0=Sun..6=Sat). */
export function startOfWeek(iso: string, weekStartDow: number): string {
  const dow = parseISO(iso).getUTCDay();
  const diff = (dow - weekStartDow + 7) % 7;
  return addDays(iso, -diff);
}

/** The [start, end] of the week containing `iso`. */
export function weekRangeContaining(iso: string, weekStartDow: number): DateRange {
  const start = startOfWeek(iso, weekStartDow);
  return { start, end: addDays(start, 6) };
}

/**
 * Number of weeks spanned by a period. Fractional by default (more accurate for
 * dividing periodic income into a weekly figure); pass mode:'whole' for the
 * integer count of distinct household-weeks the range touches.
 */
export function weeksInPeriod(
  range: DateRange,
  weekStartDow = 1,
  mode: 'fractional' | 'whole' = 'fractional',
): number {
  if (mode === 'fractional') {
    return daysInclusive(range) / 7;
  }
  const firstWeekStart = startOfWeek(range.start, weekStartDow);
  const lastWeekStart = startOfWeek(range.end, weekStartDow);
  return daysBetween(firstWeekStart, lastWeekStart) / 7 + 1;
}

/** Is `iso` within [range.start, range.end] inclusive? */
export function isWithin(iso: string, range: DateRange): boolean {
  return iso >= range.start && iso <= range.end;
}

/** The [first, last] calendar day of the month containing `iso`. */
export function monthRangeContaining(iso: string): DateRange {
  const dt = parseISO(iso);
  const start = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1));
  const end = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0));
  return { start: formatISO(start), end: formatISO(end) };
}

/** Median of the gaps (in days) between consecutive sorted dates. */
export function medianGapDays(isoDates: string[]): number {
  if (isoDates.length < 2) return 0;
  const sorted = [...isoDates].sort();
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(daysBetween(sorted[i - 1], sorted[i]));
  }
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 === 0 ? (gaps[mid - 1] + gaps[mid]) / 2 : gaps[mid];
}

/** Bucket a median day-gap into a cadence. */
export function inferCadence(medianGap: number): Cadence {
  if (medianGap >= 6 && medianGap <= 8) return 'weekly';
  if (medianGap >= 12 && medianGap <= 16) return 'biweekly';
  if (medianGap >= 27 && medianGap <= 34) return 'monthly';
  return 'irregular';
}

/**
 * Count how many times a cadence occurs within `range`, projecting forward and
 * backward from `anchor`. Irregular falls back to a flat per-period estimate.
 */
export function countCadenceOccurrences(
  cadence: Cadence,
  anchor: string,
  range: DateRange,
): number {
  if (cadence === 'irregular') {
    // Estimate one occurrence per ~30 days of the window.
    return Math.max(1, Math.round(daysInclusive(range) / 30));
  }
  const step = (iso: string, dir: number): string => {
    if (cadence === 'weekly') return addDays(iso, 7 * dir);
    if (cadence === 'biweekly') return addDays(iso, 14 * dir);
    return addMonths(iso, dir); // monthly
  };
  // Walk back to at or before range.start.
  let cursor = anchor;
  while (cursor > range.start) cursor = step(cursor, -1);
  while (cursor < range.start) cursor = step(cursor, +1);
  // Count occurrences inside the range.
  let count = 0;
  while (cursor <= range.end) {
    count++;
    cursor = step(cursor, +1);
  }
  return count;
}

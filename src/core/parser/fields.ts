// Parse a single (already line-joined) transaction row string into fields.

import { parseCents } from '../money';
import { MONTHS, ROW_START, ROW_TAIL } from './patterns';

export interface ParsedFields {
  postedDate: string; // ISO yyyy-mm-dd
  description: string;
  type: 'income' | 'expense';
  amountCents: number; // signed: negative = outflow
  runningBalanceCents: number;
}

/**
 * Parse a row like "Dec 1 Zelle money sent to JOANNE STOKES Debit - $2,083.00 $3,331.55".
 * `year` resolves the statement year; `periodStartMonth` handles Dec->Jan
 * rollover (a "Jan" row on a December-period statement belongs to year+1).
 */
export function parseRow(
  row: string,
  year: number,
  periodStartMonth: number,
): ParsedFields | null {
  const startMatch = row.match(ROW_START);
  const tailMatch = row.match(ROW_TAIL);
  if (!startMatch || !tailMatch) return null;

  const month = MONTHS[startMatch[1]];
  const day = Number(startMatch[2]);
  if (!month || !day) return null;

  // Year rollover: if the period starts in Dec and this row is in an earlier
  // month (e.g. Jan), it belongs to the following calendar year.
  const rowYear = periodStartMonth >= 11 && month < periodStartMonth ? year + 1 : year;
  const postedDate = `${rowYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const typeWord = tailMatch[1]; // Debit | Credit
  const sign = tailMatch[2]; // + | -
  const amountAbs = parseCents(tailMatch[3]);
  const runningBalanceCents = parseCents(tailMatch[4]);

  const isOutflow = sign === '-' || typeWord === 'Debit';
  const amountCents = isOutflow ? -amountAbs : amountAbs;

  // Description = everything between the date prefix and the tail.
  const description = row
    .slice(startMatch[0].length, tailMatch.index)
    .replace(/\s+/g, ' ')
    .trim();

  return {
    postedDate,
    description,
    type: amountCents >= 0 ? 'income' : 'expense',
    amountCents,
    runningBalanceCents,
  };
}

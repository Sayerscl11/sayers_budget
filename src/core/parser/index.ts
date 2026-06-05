// Statement parser entry point. Consumes the plain text of a Capital One 360
// statement (newline-separated, as produced by pdf.js text extraction) and
// returns normalized transactions. Pure & deterministic — testable from .txt
// fixtures with no PDF runtime.

import type { AccountRole } from '../types';
import { parseRow } from './fields';
import { extractLabel, normalizeDescription } from './normalize';
import { buildDedupeKey } from './dedupeKey';
import {
  PERIOD_YEAR,
  ROW_START,
  ROW_TAIL,
  SECTION_HEADER,
  SKIP_ROW,
  MONTHS,
  maskFrom,
} from './patterns';

export interface RawTxn {
  accountMask: string;
  accountName: string;
  accountRole: AccountRole;
  postedDate: string;
  descriptionRaw: string;
  descriptionNorm: string;
  label: string | null;
  amountCents: number;
  runningBalanceCents: number;
  type: 'income' | 'expense';
  dedupeKey: string;
  needsReview: boolean;
}

export interface DetectedAccount {
  mask: string;
  name: string;
  role: AccountRole;
}

export interface ParseResult {
  transactions: RawTxn[];
  accounts: DetectedAccount[];
  warnings: string[];
}

/** Statement-period / date-range furniture like "Dec 1 - Dec 31, 2025" — looks
 *  like a row start but is not a transaction. */
const DATE_RANGE = /^[A-Z][a-z]{2}\s+\d{1,2}\s*-\s*[A-Z][a-z]{2}\s+\d{1,2},\s*\d{4}$/;

/** Lines that are page furniture / table headers — never transaction content. */
const NOISE =
  /^(Page \d+ of \d+|capitalone\.com|STATEMENT PERIOD|Coty Sayers|Kia Sayers|JOINT WITH|ANNUAL PERCENTAGE|\(APY\)|YTD INTEREST|CYCLE|DATE DESCRIPTION|Account Summary|Cashflow Summary|All Accounts|ACCOUNT NAME|TOTAL ENDING|IN ALL ACCOUNTS|INTEREST EARNED|OVERDRAFT|ITEM FEES|FINANCE CHARGES|THIS PERIOD|Here's your|®Thanks|\[REDACTED)/i;

function roleForAccount(name: string): AccountRole {
  const n = name.toLowerCase();
  if (n.includes('performance savings') || n.includes('savings')) return 'savings_pool';
  if (n.includes('debit card')) return 'spending_pool';
  if (n.includes('checking')) return 'main';
  return 'other';
}

export function parseStatement(text: string): ParseResult {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Resolve the statement year + the month the period starts (for Dec->Jan rollover).
  let year = new Date().getUTCFullYear();
  let periodStartMonth = 1;
  for (const l of lines) {
    const m = l.match(PERIOD_YEAR);
    if (m) {
      year = Number(m[2]);
      periodStartMonth = MONTHS[m[1]] ?? 1;
      break;
    }
  }

  const transactions: RawTxn[] = [];
  const accounts = new Map<string, DetectedAccount>();
  const warnings: string[] = [];
  const expectedBalance = new Map<string, number>();

  let current: DetectedAccount | null = null;
  let buffer = '';

  const isRowStart = (l: string) => ROW_START.test(l) && !SKIP_ROW.test(l);

  const flushIncomplete = () => {
    if (buffer) {
      warnings.push(`Dropped incomplete row: ${buffer.slice(0, 80)}`);
      buffer = '';
    }
  };

  const commit = (rowText: string) => {
    if (!current) {
      warnings.push(`Row before any account header: ${rowText.slice(0, 60)}`);
      return;
    }
    const parsed = parseRow(rowText, year, periodStartMonth);
    if (!parsed) {
      warnings.push(`Unparseable row: ${rowText.slice(0, 80)}`);
      return;
    }
    const descriptionNorm = normalizeDescription(parsed.description);
    // Running-balance cross-check.
    let needsReview = false;
    const prev = expectedBalance.get(current.mask);
    if (prev !== undefined && prev + parsed.amountCents !== parsed.runningBalanceCents) {
      needsReview = true;
    }
    expectedBalance.set(current.mask, parsed.runningBalanceCents);

    transactions.push({
      accountMask: current.mask,
      accountName: current.name,
      accountRole: current.role,
      postedDate: parsed.postedDate,
      descriptionRaw: parsed.description,
      descriptionNorm,
      label: extractLabel(parsed.description),
      amountCents: parsed.amountCents,
      runningBalanceCents: parsed.runningBalanceCents,
      type: parsed.type,
      dedupeKey: buildDedupeKey({
        accountMask: current.mask,
        postedDate: parsed.postedDate,
        amountCents: parsed.amountCents,
        descriptionNorm,
      }),
      needsReview,
    });
  };

  for (const line of lines) {
    // Period/date-range furniture (mimics a row start) — always skip.
    if (DATE_RANGE.test(line)) continue;

    // Account section header. A header never carries a money tail and never
    // starts with a date, so it's safe to recognize even mid-buffer (and it
    // definitively ends any incomplete row).
    if (SECTION_HEADER.test(line) && !ROW_TAIL.test(line) && !isRowStart(line)) {
      const header = line.match(SECTION_HEADER)!;
      flushIncomplete();
      const name = header[1].trim();
      const mask = maskFrom(header[2]);
      const role = roleForAccount(name);
      current = { mask, name, role };
      if (!accounts.has(mask)) accounts.set(mask, current);
      continue;
    }

    // Seed opening balance so the cross-check has a starting point.
    if (current && SKIP_ROW.test(line) && /Opening Balance/.test(line)) {
      const m = line.match(/\$(-?[0-9,]+\.\d{2})\s*$/);
      if (m) expectedBalance.set(current.mask, Number(m[1].replace(/,/g, '')) * 100);
      continue;
    }
    if (SKIP_ROW.test(line)) continue; // Closing Balance etc.

    if (isRowStart(line)) {
      // A new row begins — whatever was buffered never completed.
      flushIncomplete();
      buffer = line;
    } else if (buffer) {
      // Continuation: skip page furniture, otherwise append to the open row.
      if (NOISE.test(line) || SECTION_HEADER.test(line)) continue;
      buffer = `${buffer} ${line}`;
    } else {
      continue; // noise outside any row
    }

    // Complete once the buffer carries a full money tail.
    if (buffer && ROW_TAIL.test(buffer)) {
      commit(buffer);
      buffer = '';
    }
  }
  flushIncomplete();

  return {
    transactions,
    accounts: [...accounts.values()],
    warnings,
  };
}

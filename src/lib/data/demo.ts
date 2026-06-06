// Demo data source: parse the committed (sanitized, real) Capital One
// statements and feed the engine. Runs server-side only (reads from disk).

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseStatement, rawTxnsToTxns } from '@core/parser';
import type { AccountRef, Txn } from '@core/types';
import type { BudgetData } from './source';
import { HOUSEHOLD } from '../household';

const FIXTURE_DIR = resolve(process.cwd(), 'tests/fixtures');

export function loadDemoData(): BudgetData {
  const files = readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.txt'))
    .sort();

  const txns: Txn[] = [];
  const accounts = new Map<string, AccountRef>();
  for (const file of files) {
    const result = parseStatement(readFileSync(resolve(FIXTURE_DIR, file), 'utf8'));
    for (const a of result.accounts) {
      if (!accounts.has(a.mask)) accounts.set(a.mask, a);
    }
    for (const t of rawTxnsToTxns(result.transactions, file)) txns.push(t);
  }

  // Anchor "today" to the latest transaction so the dashboard reflects the most
  // recent statement period (a real deployment uses the actual current date).
  const today =
    txns.reduce((max, t) => (t.postedDate > max ? t.postedDate : max), '0000-00-00') ||
    new Date().toISOString().slice(0, 10);

  return {
    txns,
    accounts: [...accounts.values()],
    household: HOUSEHOLD,
    today,
    source: 'demo',
  };
}

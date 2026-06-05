import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseStatement } from '../src/core/parser';
import type { Txn, AccountRef } from '../src/core/types';

const FIXTURE_DIR = resolve(__dirname, 'fixtures');

/** Parse every fixture and return a combined, engine-ready transaction list. */
export function loadAllTxns(): { txns: Txn[]; accounts: AccountRef[] } {
  const files = readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.txt'))
    .sort();
  const txns: Txn[] = [];
  const accounts = new Map<string, AccountRef>();
  let i = 0;
  for (const file of files) {
    const result = parseStatement(readFileSync(resolve(FIXTURE_DIR, file), 'utf8'));
    for (const a of result.accounts) {
      if (!accounts.has(a.mask)) accounts.set(a.mask, a);
    }
    for (const t of result.transactions) {
      txns.push({ ...t, id: `${file}:${i++}` });
    }
  }
  return { txns, accounts: [...accounts.values()] };
}

export function loadOne(file: string): { txns: Txn[]; accounts: AccountRef[] } {
  const result = parseStatement(readFileSync(resolve(FIXTURE_DIR, file), 'utf8'));
  return {
    txns: result.transactions.map((t, i) => ({ ...t, id: `${file}:${i}` })),
    accounts: result.accounts,
  };
}

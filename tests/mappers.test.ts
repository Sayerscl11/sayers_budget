import { describe, it, expect } from 'vitest';
import {
  dbRowToTxn,
  dbAccountToRef,
  type DbAccountRow,
  type DbTxnRow,
} from '../src/lib/db/mappers';

const checking: DbAccountRow = { id: 'acc-1', mask: '4333', name: '360 Checking', role: 'main' };
const accountsById = new Map([[checking.id, checking]]);

const row: DbTxnRow = {
  id: 'txn-1',
  account_id: 'acc-1',
  posted_date: '2026-04-10',
  description_raw: 'Dinner - Withdrawal to Debit Card Account',
  description_norm: 'DINNER',
  label: 'Dinner',
  amount_cents: '-4000', // PostgREST may serialize bigint as a string
  running_balance_cents: '125000',
  type: 'expense',
  is_transfer: false,
  transfer_group_id: null,
  is_savings: false,
  dedupe_key: 'abc',
  needs_review: false,
};

describe('dbRowToTxn', () => {
  it('resolves account mask/role from the joined account and coerces bigint cents', () => {
    const txn = dbRowToTxn(row, accountsById);
    expect(txn).toMatchObject({
      id: 'txn-1',
      accountMask: '4333',
      accountRole: 'main',
      postedDate: '2026-04-10',
      label: 'Dinner',
      amountCents: -4000,
      runningBalanceCents: 125000,
    });
    expect(typeof txn.amountCents).toBe('number');
  });

  it('falls back to role "other" (never drops) when the account is missing', () => {
    const txn = dbRowToTxn({ ...row, account_id: 'gone' }, accountsById);
    expect(txn.accountRole).toBe('other');
    expect(txn.accountMask).toBe('');
  });

  it('keeps a null running balance null rather than coercing to 0', () => {
    const txn = dbRowToTxn({ ...row, running_balance_cents: null }, accountsById);
    expect(txn.runningBalanceCents).toBeNull();
  });
});

describe('dbAccountToRef', () => {
  it('strips the db id, keeping the engine-relevant fields', () => {
    expect(dbAccountToRef(checking)).toEqual({
      mask: '4333',
      name: '360 Checking',
      role: 'main',
    });
  });
});

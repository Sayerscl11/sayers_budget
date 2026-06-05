// The single semantic classifier that anchors all budget math. It encodes the
// household's actual bookkeeping: everything is driven off the MAIN (checking)
// account, where they record labeled "Withdrawal to Debit Card Account" entries
// as their categorized discretionary spend. The spending-pool (...2997) and
// savings-pool (...5534) accounts are downstream MIRRORS and are ignored to
// avoid double-counting.

import type { AccountRef, Txn } from '../types';
import { ownedFrom, referencesOwnedAccount } from './transfers';

export type BudgetBucket =
  | 'income' // external money in (payroll, interest)
  | 'bill' // external money out (rent, utilities, card payment...)
  | 'discretionary' // labeled debit-card funding = personal spend
  | 'savings' // money moved to savings / Wealthfront
  | 'transfer' // neutral internal movement
  | 'mirror'; // activity inside a pool account; ignored

const TO_DEBIT_CARD = /Withdrawal to Debit Card Account/i;
const TO_SAVINGS = /Performance Savings/i;

/** Classify a single transaction into its budget bucket. */
export function budgetBucket(txn: Txn, accounts: AccountRef[]): BudgetBucket {
  // Pool accounts mirror the checking-side records — never count them.
  if (txn.accountRole === 'spending_pool' || txn.accountRole === 'savings_pool') {
    return 'mirror';
  }

  const raw = txn.descriptionRaw;
  const isOutflow = txn.amountCents < 0;

  // Labeled funding of the discretionary debit card = personal spend.
  if (isOutflow && TO_DEBIT_CARD.test(raw)) return 'discretionary';

  // Money earmarked for savings/investing (separate goal, not subtracted).
  if (isOutflow && (TO_SAVINGS.test(raw) || txn.descriptionNorm === 'WEALTHFRONT')) {
    return 'savings';
  }
  // Money pulled BACK from investing is a neutral transfer, not income.
  if (!isOutflow && (TO_SAVINGS.test(raw) || txn.descriptionNorm === 'WEALTHFRONT')) {
    return 'transfer';
  }

  // Any other movement that references an owned account is a neutral transfer.
  const owned = ownedFrom(accounts);
  if (referencesOwnedAccount(txn, owned)) return 'transfer';

  return isOutflow ? 'bill' : 'income';
}

/** Convenience: attach the bucket to each txn. */
export function withBuckets(
  txns: Txn[],
  accounts: AccountRef[],
): Array<Txn & { bucket: BudgetBucket }> {
  return txns.map((t) => ({ ...t, bucket: budgetBucket(t, accounts) }));
}

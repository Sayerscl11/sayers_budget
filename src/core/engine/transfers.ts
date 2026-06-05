// Internal-transfer detection. The statement names the counterparty account in
// the description ("Withdrawal to 360 Performance Savings", "Deposit from 360
// Checking"), which is a high-precision signal that a movement is between the
// household's own accounts and therefore must not count as income or expense.

import type { AccountRef, Txn } from '../types';

export interface OwnedAccounts {
  /** Lowercased account names, e.g. "360 checking". */
  names: string[];
  /** Last-4 masks, e.g. "4333". */
  masks: string[];
}

export function ownedFrom(accounts: AccountRef[]): OwnedAccounts {
  return {
    names: accounts.map((a) => a.name.toLowerCase()),
    masks: accounts.map((a) => a.mask),
  };
}

/** Does this txn's description reference one of the household's OTHER accounts?
 *  Used to flag neutral internal movements (e.g. "Deposit from 360 Performance
 *  Savings"). The txn's own account mask is excluded so self-references don't
 *  count. */
export function referencesOwnedAccount(txn: Txn, owned: OwnedAccounts): boolean {
  const raw = txn.descriptionRaw.toLowerCase();
  const nameHit = owned.names.some((n) => n.length > 0 && raw.includes(n));
  const maskHit = owned.masks.some((m) => m !== txn.accountMask && raw.includes(m));
  return nameHit || maskHit;
}

export interface TransferGroup {
  id: string;
  legs: string[]; // txn ids
  amountCents: number; // absolute
}

/**
 * Flag internal transfers and pair their two legs where both are visible.
 * Mutates a shallow copy of each txn with isTransfer / transferGroupId.
 */
export function detectTransfers(
  txns: Txn[],
  accounts: AccountRef[],
): { txns: Txn[]; groups: TransferGroup[] } {
  const owned = ownedFrom(accounts);
  const out = txns.map((t) => ({ ...t }));

  // Primary signal: description references another owned account.
  for (const t of out) {
    if (referencesOwnedAccount(t, owned)) t.isTransfer = true;
  }

  // Pair outflow<->inflow legs (equal magnitude, within 3 days).
  const groups: TransferGroup[] = [];
  const candidates = out.filter((t) => t.isTransfer);
  const used = new Set<string>();
  for (const a of candidates) {
    if (used.has(a.id) || a.amountCents >= 0) continue; // start from outflows
    const match = candidates.find(
      (b) =>
        !used.has(b.id) &&
        b.id !== a.id &&
        b.amountCents === -a.amountCents &&
        Math.abs(daysApart(a.postedDate, b.postedDate)) <= 3,
    );
    if (match) {
      const id = `tg_${a.id}`;
      a.transferGroupId = id;
      match.transferGroupId = id;
      used.add(a.id);
      used.add(match.id);
      groups.push({ id, legs: [a.id, match.id], amountCents: -a.amountCents });
    }
  }
  return { txns: out, groups };
}

function daysApart(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

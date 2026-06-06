// Pure mappers from Supabase rows (snake_case, bigint cents) to the engine's
// camelCase domain types. Kept separate and unit-tested so the data-source
// adapter stays a thin query layer.

import type { AccountRef, AccountRole, Txn, TxnType } from '@core/types';

export interface DbAccountRow {
  id: string;
  mask: string;
  name: string;
  role: AccountRole;
}

export interface DbTxnRow {
  id: string;
  account_id: string | null;
  posted_date: string;
  description_raw: string;
  description_norm: string;
  label: string | null;
  amount_cents: number | string;
  running_balance_cents: number | string | null;
  type: TxnType | null;
  is_transfer: boolean;
  transfer_group_id: string | null;
  is_savings: boolean;
  dedupe_key: string;
  needs_review: boolean;
}

export function dbAccountToRef(row: DbAccountRow): AccountRef {
  return { mask: row.mask, name: row.name, role: row.role };
}

/**
 * Map a transaction row to the engine `Txn`. The engine keys off the account's
 * mask + role, so the joined account is required to resolve them; rows whose
 * account is missing fall back to an `other` role (still counted, never
 * silently dropped).
 */
export function dbRowToTxn(
  row: DbTxnRow,
  accountsById: Map<string, DbAccountRow>,
): Txn {
  const account = row.account_id ? accountsById.get(row.account_id) : undefined;
  return {
    id: row.id,
    accountMask: account?.mask ?? '',
    accountRole: account?.role ?? 'other',
    postedDate: row.posted_date,
    descriptionRaw: row.description_raw,
    descriptionNorm: row.description_norm,
    label: row.label,
    amountCents: Number(row.amount_cents),
    runningBalanceCents:
      row.running_balance_cents == null ? null : Number(row.running_balance_cents),
    type: row.type ?? undefined,
    isTransfer: row.is_transfer,
    transferGroupId: row.transfer_group_id,
    isSavings: row.is_savings,
    dedupeKey: row.dedupe_key,
    needsReview: row.needs_review,
  };
}

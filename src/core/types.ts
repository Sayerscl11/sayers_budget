// Framework-agnostic domain types shared by the parser and engine.
// No Next/React/Supabase/Plaid imports allowed in src/core/**.

/** Semantic role of an account, which drives budgeting logic. */
export type AccountRole = 'main' | 'spending_pool' | 'savings_pool' | 'other';

/** A transaction's economic type once classified. */
export type TxnType = 'income' | 'expense' | 'transfer';

/** How often a recurring item repeats. */
export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'irregular';

/** Direction of a recurring item. */
export type RecurringDirection = 'income' | 'bill';

/** Where a transaction came from. */
export type TxnSource = 'pdf' | 'manual' | 'plaid';

/** An account as the engine/parser understands it. */
export interface AccountRef {
  /** Last-4 (or more) mask, e.g. "4333". Stable identifier within a household. */
  mask: string;
  /** Human name as printed on the statement, e.g. "360 Checking". */
  name: string;
  role: AccountRole;
}

/**
 * A normalized transaction. Amounts are signed integer CENTS:
 * negative = money out (outflow), positive = money in (inflow).
 */
export interface Txn {
  /** Stable id (db id at runtime; synthetic in tests). */
  id: string;
  accountMask: string;
  accountRole: AccountRole;
  /** ISO date yyyy-mm-dd. */
  postedDate: string;
  descriptionRaw: string;
  /** Normalized merchant stem used for grouping/dedupe. */
  descriptionNorm: string;
  /** Hand-typed discretionary label (Gas, Costco, Dinner...) when present. */
  label?: string | null;
  /** Signed amount in cents. Negative = outflow. */
  amountCents: number;
  /** Running balance in cents (PDF only). */
  runningBalanceCents?: number | null;
  /** Economic type. May be pre-set by a user override. */
  type?: TxnType;
  /** True if this is an internal transfer between owned accounts. */
  isTransfer?: boolean;
  /** Links the two legs of a matched transfer. */
  transferGroupId?: string | null;
  /** True if this transfer feeds savings (savings_pool / Wealthfront). */
  isSavings?: boolean;
  /** Stable dedupe key (same economic event => same key across sources). */
  dedupeKey?: string;
  /** Parser flagged this row as suspect (e.g. balance mismatch). */
  needsReview?: boolean;
}

/** Household configuration that affects week math. */
export interface HouseholdConfig {
  /** IANA timezone, e.g. "America/New_York". */
  timezone: string;
  /** Day of week the budgeting week starts on. 0=Sun .. 6=Sat. */
  weekStartDow: number;
}

/** Inclusive date range [start, end] as ISO yyyy-mm-dd. */
export interface DateRange {
  start: string;
  end: string;
}

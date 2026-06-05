// Single source of truth for the regexes & month map used to parse Capital One
// 360 statement text. Kept in one file so format tweaks live in one place.

export const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

/** A line that begins a transaction row: "Dec 1 ...". Captures month + day. */
export const ROW_START = /^([A-Z][a-z]{2}) (\d{1,2})\b/;

/**
 * The trailing money portion of a (possibly multi-line) transaction:
 * "Debit - $2,083.00 $3,331.55" / "Credit + $3,643.39 $3,929.35".
 * Captures: type, sign, amount, runningBalance.
 */
export const ROW_TAIL =
  /(Debit|Credit)\s+([+-])\s+\$([0-9,]+\.\d{2})\s+\$(-?[0-9,]+\.\d{2})\s*$/;

/**
 * An account section header: "360 Checking - XXXXXXX4333".
 * Captures: account name, masked number (we take the last 4 as the mask).
 */
export const SECTION_HEADER = /^(.+?) - (X{2,}\d{4}|\d{6,})\s*$/;

/** Statement period line: "Dec 1 - Dec 31, 2025". Captures the 4-digit year. */
export const PERIOD_YEAR = /\b([A-Z][a-z]{2})\s+\d{1,2}\s*-\s*[A-Z][a-z]{2}\s+\d{1,2},\s*(\d{4})/;

/** Discretionary label: "Magnesium - Withdrawal to Debit Card Account". */
export const DEBIT_CARD_LABEL =
  /^(.*?)\s*-\s*Withdrawal to Debit Card Account\b/i;

/** Bare (unlabeled) debit-card funding withdrawal. */
export const DEBIT_CARD_BARE = /^Withdrawal to Debit Card Account\b/i;

/** Rows we should skip even though they start with a date (not transactions). */
export const SKIP_ROW = /\b(Opening|Closing) Balance\b/;

/** Take the trailing 4 digits of a masked/raw account number as the mask. */
export function maskFrom(accountNumber: string): string {
  return accountNumber.slice(-4);
}

// Money is always integer CENTS to avoid float drift. These helpers are the
// only sanctioned place to convert between dollars and cents.

/** Parse a currency-ish string like "$1,234.56" or "1234.56" into cents. */
export function parseCents(input: string): number {
  const cleaned = input.replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') {
    throw new Error(`Cannot parse money from: ${JSON.stringify(input)}`);
  }
  const dollars = Number(cleaned);
  if (!Number.isFinite(dollars)) {
    throw new Error(`Cannot parse money from: ${JSON.stringify(input)}`);
  }
  return Math.round(dollars * 100);
}

/** Convert a number of dollars to integer cents. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Format integer cents as a localized USD string, e.g. 123456 -> "$1,234.56". */
export function formatCurrency(
  cents: number,
  opts: { showCents?: boolean } = {},
): string {
  const showCents = opts.showCents ?? true;
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
}

/** Sum a list of cent amounts. */
export function sumCents(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

/** Median of cent amounts (robust to outliers like variable rent). */
export function medianCents(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

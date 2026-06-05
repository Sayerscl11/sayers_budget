// The headline number: how much is free to spend on personal stuff per week.
// safe-to-spend = (recurring income - recurring bills) / weeks in the period.
// Savings is excluded from bills upstream, so it is not subtracted here.

export interface SafeToSpendInput {
  incomeCents: number;
  billsCents: number;
  /** Weeks spanned by the forecast period (may be fractional). */
  weeks: number;
}

export interface SafeToSpendBreakdown {
  incomeCents: number;
  billsCents: number;
  netCents: number;
  weeks: number;
  perWeekCents: number;
}

export function weeklySafeToSpend(input: SafeToSpendInput): number {
  return safeToSpendBreakdown(input).perWeekCents;
}

export function safeToSpendBreakdown(input: SafeToSpendInput): SafeToSpendBreakdown {
  const netCents = input.incomeCents - input.billsCents;
  const weeks = input.weeks > 0 ? input.weeks : 1;
  return {
    incomeCents: input.incomeCents,
    billsCents: input.billsCents,
    netCents,
    weeks,
    perWeekCents: Math.floor(netCents / weeks),
  };
}

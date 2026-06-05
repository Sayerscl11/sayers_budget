// Public surface of the budgeting engine.

export { detectTransfers, ownedFrom, referencesOwnedAccount } from './transfers';
export type { TransferGroup, OwnedAccounts } from './transfers';

export { budgetBucket, withBuckets } from './classify';
export type { BudgetBucket } from './classify';

export { detectRecurring } from './recurring';
export type { RecurringCandidate } from './recurring';

export { computePeriodTotals } from './period';
export type { RecurringItemInput, PeriodTotals } from './period';

export { weeklySafeToSpend, safeToSpendBreakdown } from './safeToSpend';
export type { SafeToSpendInput, SafeToSpendBreakdown } from './safeToSpend';

export { weeklySpendSoFar } from './weeklySpend';
export type { WeeklySpend, CategorySpend } from './weeklySpend';

export { savingsProgress } from './savings';
export type { SavingsProgress } from './savings';

export { forecast, defaultForecastItems } from './forecast';
export type { ForecastInput, DashboardForecast } from './forecast';

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

export { forecast, defaultForecastItems, normalizedForecastWindow } from './forecast';
export type { ForecastInput, DashboardForecast } from './forecast';

export { buildRecurringRows, rowsToForecastItems } from './recurringPlan';
export type { RecurringOverride, RecurringRow } from './recurringPlan';

export { envelopeStatuses, monthlySpendByCategory, suggestEnvelopes } from './envelopes';
export type { EnvelopeBudget, EnvelopeStatus, MonthlyCategorySpend } from './envelopes';

export { cardMerchant, isCardPurchase } from './merchant';
export type { Merchant } from './merchant';

export {
  detectSubscriptions,
  subscriptionMonthlyCents,
  subscriptionMonth,
  subscriptionForecastItems,
} from './subscriptions';
export type { Subscription, SubscriptionOverride, SubscriptionMonth } from './subscriptions';

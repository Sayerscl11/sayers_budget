// The UI talks to this seam, never directly to a database or the filesystem.
// Today it's backed by the committed statement fixtures (`demo`); in M2 the
// Supabase-backed source drops in here with no UI changes.

import type { AccountRef, HouseholdConfig, Txn } from '@core/types';
import { loadDemoData } from './demo';
import { useSupabaseData } from '../env';

export interface BudgetData {
  txns: Txn[];
  accounts: AccountRef[];
  household: HouseholdConfig;
  /** Today's date (ISO) resolved for the dashboard. */
  today: string;
  /** Where this data came from, surfaced in the UI as a banner. */
  source: 'demo' | 'supabase';
}

/**
 * Load the household's budget data. Until a Supabase project is configured the
 * app runs against the sanitized real statements, so the whole vertical slice
 * (parse -> engine -> dashboard) is exercised end-to-end.
 */
export async function loadBudgetData(): Promise<BudgetData> {
  if (useSupabaseData()) {
    // Lazy import so the demo build never pulls in next/headers (request-scoped).
    const { loadSupabaseData } = await import('./supabase');
    return loadSupabaseData();
  }
  return loadDemoData();
}

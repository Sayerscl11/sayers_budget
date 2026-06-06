// Household configuration that drives week boundaries and forecasting. In M2
// this is read from the `households` row; for now it's the Sayers' confirmed
// setup (Eastern time, weeks start Monday).

import type { HouseholdConfig } from '@core/types';

export const HOUSEHOLD: HouseholdConfig = {
  timezone: 'America/New_York',
  weekStartDow: 1, // Monday
};

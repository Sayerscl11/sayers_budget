import { describe, it, expect } from 'vitest';
import { loadAllTxns } from './_load';
import {
  detectRecurring,
  defaultForecastItems,
  buildRecurringRows,
  rowsToForecastItems,
  type RecurringOverride,
} from '../src/core/engine';

const { txns, accounts } = loadAllTxns();
const detected = detectRecurring(txns, accounts);

describe('buildRecurringRows / rowsToForecastItems', () => {
  it('with no overrides, reproduces defaultForecastItems exactly', () => {
    const rows = buildRecurringRows(detected, []);
    const viaRows = rowsToForecastItems(rows);
    const baseline = defaultForecastItems(detected);

    const norm = (xs: typeof baseline) =>
      [...xs]
        .map((i) => `${i.direction}|${i.cadence}|${i.anchorDate}|${i.amountCents}|${i.isSavings ?? false}`)
        .sort();
    expect(norm(viaRows)).toEqual(norm(baseline));
  });

  it('an override amount wins over the detected amount', () => {
    const rent = detected.find((r) => r.matchNorm === 'LEGACY REAL ESTATE')!;
    const ov: RecurringOverride = {
      direction: 'bill',
      matchNorm: 'LEGACY REAL ESTATE',
      isActive: true,
      isSavings: false,
      cadence: 'monthly',
      anchorDate: rent.anchorDate,
      amountCents: 250000,
      amountSource: 'override',
    };
    const row = buildRecurringRows(detected, [ov]).find(
      (r) => r.matchNorm === 'LEGACY REAL ESTATE',
    )!;
    expect(row.amountCents).toBe(250000);
    expect(row.detectedAmountCents).toBe(rent.detectedAmountCents);
    expect(row.confirmed).toBe(true);
  });

  it('deactivating an item removes it from the forecast inputs', () => {
    const nissan = detected.find((r) => r.matchNorm === 'NISSAN AUTO LOAN')!;
    const ov: RecurringOverride = {
      direction: 'bill',
      matchNorm: 'NISSAN AUTO LOAN',
      isActive: false,
      isSavings: false,
      cadence: nissan.cadence,
      anchorDate: nissan.anchorDate,
      amountCents: nissan.detectedAmountCents,
      amountSource: 'detected',
    };
    const items = rowsToForecastItems(buildRecurringRows(detected, [ov]));
    expect(items.some((i) => i.amountCents === nissan.detectedAmountCents && i.direction === 'bill'))
      .toBe(false);
  });

  it('marking a bill as savings excludes it from bills (isSavings flag passes through)', () => {
    const ov: RecurringOverride = {
      direction: 'bill',
      matchNorm: 'WEALTHFRONT MANUAL',
      isActive: true,
      isSavings: true,
      cadence: 'monthly',
      anchorDate: '2026-01-15',
      amountCents: 30000,
      amountSource: 'override',
    };
    const items = rowsToForecastItems(buildRecurringRows(detected, [ov]));
    const item = items.find((i) => i.amountCents === 30000);
    expect(item?.isSavings).toBe(true);
  });

  it('keeps a saved item that no longer appears in detection', () => {
    const ov: RecurringOverride = {
      direction: 'bill',
      matchNorm: 'OLD GYM',
      isActive: true,
      isSavings: false,
      cadence: 'monthly',
      anchorDate: '2026-01-01',
      amountCents: 5000,
      amountSource: 'override',
    };
    const rows = buildRecurringRows(detected, [ov]);
    const row = rows.find((r) => r.matchNorm === 'OLD GYM');
    expect(row).toBeDefined();
    expect(row?.detectedAmountCents).toBeNull();
    expect(row?.name).toBe('Old Gym');
  });
});

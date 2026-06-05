import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseStatement } from '../src/core/parser';

const FIXTURE_DIR = resolve(__dirname, 'fixtures');
const fixtureFiles = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.txt'));

function load(name: string) {
  return readFileSync(resolve(FIXTURE_DIR, name), 'utf8');
}

describe('parseStatement — across all real statements', () => {
  it('found fixtures to test', () => {
    expect(fixtureFiles.length).toBe(5);
  });

  for (const file of fixtureFiles) {
    describe(file, () => {
      const result = parseStatement(load(file));

      it('detects the three accounts with correct roles', () => {
        const byMask = Object.fromEntries(result.accounts.map((a) => [a.mask, a]));
        expect(byMask['4333']?.role).toBe('main');
        expect(byMask['2997']?.role).toBe('spending_pool');
        expect(byMask['5534']?.role).toBe('savings_pool');
      });

      it('parses a healthy number of transactions', () => {
        expect(result.transactions.length).toBeGreaterThan(100);
      });

      it('keeps balance-mismatch flags rare (< 3% of rows)', () => {
        const flagged = result.transactions.filter((t) => t.needsReview).length;
        expect(flagged / result.transactions.length).toBeLessThan(0.03);
      });

      it('every transaction has a stable dedupe key and ISO date', () => {
        for (const t of result.transactions) {
          expect(t.dedupeKey).toMatch(/^[0-9a-f]{8}$/);
          expect(t.postedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      });
    });
  }
});

describe('parseStatement — December 2025 specifics', () => {
  const result = parseStatement(load('statement_20251201.txt'));
  const find = (re: RegExp) =>
    result.transactions.find((t) => re.test(t.descriptionRaw));

  it('rejoins a wrapped funding row and extracts its label (from checking)', () => {
    // The labeled "X - Withdrawal to Debit Card Account" rows live in the
    // checking account and carry the household's discretionary category.
    const mag = result.transactions.find(
      (t) => /Magnesium/.test(t.descriptionRaw) && t.accountMask === '4333',
    );
    expect(mag).toBeDefined();
    expect(mag!.label).toBe('Magnesium');
    expect(mag!.amountCents).toBe(-4500);
    expect(mag!.accountRole).toBe('main');
  });

  it('normalizes rent to a stable merchant stem (outflow)', () => {
    const rent = find(/Legacy Real Est/);
    expect(rent!.descriptionNorm).toBe('LEGACY REAL ESTATE');
    expect(rent!.amountCents).toBeLessThan(0);
    expect(rent!.type).toBe('expense');
  });

  it('parses payroll as a positive income transaction', () => {
    const pay = find(/INTRALOX/);
    expect(pay!.amountCents).toBeGreaterThan(0);
    expect(pay!.type).toBe('income');
    expect(pay!.descriptionNorm).toBe('INTRALOX PAYROLL');
  });

  it('extracts the discretionary labels the household hand-types', () => {
    const labels = new Set(
      result.transactions.map((t) => t.label).filter(Boolean) as string[],
    );
    for (const expected of ['Dinner', 'Gas', 'Grocery', 'Amazon']) {
      expect(labels).toContain(expected);
    }
  });
});

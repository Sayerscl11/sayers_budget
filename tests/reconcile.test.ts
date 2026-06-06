import { describe, it, expect } from 'vitest';
import {
  reconcileIngest,
  descSimilarity,
  type StoredRecord,
  type IngestRecord,
} from '../src/lib/ingest/reconcile';

const base: Omit<IngestRecord, 'source' | 'dedupeKey'> = {
  accountMask: '4333',
  postedDate: '2026-04-10',
  amountCents: -4000,
  descriptionNorm: 'DINNER',
};

function stored(over: Partial<StoredRecord>): StoredRecord {
  return { id: 'e1', source: 'manual', dedupeKey: 'k1', ...base, ...over };
}
function incoming(over: Partial<IngestRecord>): IngestRecord {
  return { source: 'pdf', dedupeKey: 'k1', ...base, ...over };
}

describe('reconcileIngest — cross-source dedupe decisions', () => {
  it('inserts genuinely new rows', () => {
    const plan = reconcileIngest([], [incoming({ dedupeKey: 'new' })]);
    expect(plan.inserts).toBe(1);
    expect(plan.actions[0].kind).toBe('insert');
  });

  it('skips an exact-key re-import from the same/lower-priority source', () => {
    const existing = [stored({ source: 'pdf', dedupeKey: 'k1' })];
    const plan = reconcileIngest(existing, [incoming({ source: 'pdf', dedupeKey: 'k1' })]);
    expect(plan.skipped).toBe(1);
    expect(plan.actions[0]).toMatchObject({ kind: 'skip', reason: 'duplicate' });
  });

  it('upgrades a PDF row when Plaid later delivers the same event', () => {
    const existing = [stored({ source: 'pdf', dedupeKey: 'k1', userOverridden: true })];
    const plan = reconcileIngest(existing, [incoming({ source: 'plaid', dedupeKey: 'k1' })]);
    expect(plan.replaced).toBe(1);
    expect(plan.actions[0]).toMatchObject({
      kind: 'replace',
      targetId: 'e1',
      preserveUserData: true, // keep the user's category
    });
  });

  it('does NOT downgrade: a manual re-entry never replaces a PDF row', () => {
    const existing = [stored({ source: 'pdf', dedupeKey: 'k1' })];
    const plan = reconcileIngest(existing, [incoming({ source: 'manual', dedupeKey: 'k1' })]);
    expect(plan.skipped).toBe(1);
  });

  it('fuzzy-supersedes a manual entry when the import arrives a day later', () => {
    // Logged "$40 dinner" manually on the 10th; PDF import lands it on the 11th
    // with a richer description and a different dedupe key.
    const existing = [
      stored({ source: 'manual', dedupeKey: 'manual-1', userOverridden: true }),
    ];
    const plan = reconcileIngest(existing, [
      incoming({
        source: 'pdf',
        dedupeKey: 'pdf-1',
        postedDate: '2026-04-11',
        descriptionNorm: 'DINNER PURCHASE',
      }),
    ]);
    expect(plan.superseded).toBe(1);
    expect(plan.actions[0]).toMatchObject({
      kind: 'supersede',
      targetId: 'e1',
      preserveUserData: true,
    });
  });

  it('does not fuzzy-match when the amount differs', () => {
    const existing = [stored({ source: 'manual', dedupeKey: 'manual-1' })];
    const plan = reconcileIngest(existing, [
      incoming({ source: 'pdf', dedupeKey: 'pdf-1', amountCents: -4500 }),
    ]);
    expect(plan.inserts).toBe(1);
    expect(plan.superseded).toBe(0);
  });

  it('does not fuzzy-match outside the 3-day window', () => {
    const existing = [stored({ source: 'manual', dedupeKey: 'manual-1' })];
    const plan = reconcileIngest(existing, [
      incoming({ source: 'pdf', dedupeKey: 'pdf-1', postedDate: '2026-04-20' }),
    ]);
    expect(plan.inserts).toBe(1);
  });

  it('collapses duplicate keys within a single batch, keeping highest priority', () => {
    const plan = reconcileIngest(
      [],
      [
        incoming({ source: 'pdf', dedupeKey: 'dup' }),
        incoming({ source: 'plaid', dedupeKey: 'dup' }),
      ],
    );
    expect(plan.inserts).toBe(1);
    expect(plan.actions[0]).toMatchObject({ kind: 'insert' });
    expect((plan.actions[0] as { record: IngestRecord }).record.source).toBe('plaid');
  });

  it('re-importing an unchanged statement is a complete no-op', () => {
    const existing = [
      stored({ id: 'a', source: 'pdf', dedupeKey: 'k1' }),
      stored({ id: 'b', source: 'pdf', dedupeKey: 'k2', postedDate: '2026-04-12' }),
    ];
    const plan = reconcileIngest(existing, [
      incoming({ source: 'pdf', dedupeKey: 'k1' }),
      incoming({ source: 'pdf', dedupeKey: 'k2', postedDate: '2026-04-12' }),
    ]);
    expect(plan.inserts).toBe(0);
    expect(plan.skipped).toBe(2);
  });
});

describe('descSimilarity', () => {
  it('is 1 for identical strings and lower for divergent ones', () => {
    expect(descSimilarity('DINNER', 'DINNER')).toBe(1);
    expect(descSimilarity('DINNER PURCHASE', 'DINNER')).toBeGreaterThanOrEqual(0.5);
    expect(descSimilarity('DINNER', 'GAS STATION')).toBe(0);
  });
});

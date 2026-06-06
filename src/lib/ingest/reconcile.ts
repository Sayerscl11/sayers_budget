// Cross-source dedupe — the decision logic that keeps PDF, manual, and Plaid
// imports from double-counting the same real-world transaction. Pure and
// DB-agnostic: it takes the rows already stored plus a batch of incoming rows
// and returns a *plan* (insert / replace / supersede / skip) that the Supabase
// adapter then applies inside one transaction. Testable with no database.

import { daysBetween } from '@core/dates';
import type { TxnSource } from '@core/types';

/** A normalized row from any source, ready to be reconciled and stored. */
export interface IngestRecord {
  dedupeKey: string;
  source: TxnSource;
  /** Source-native id (Plaid transaction_id, import batch ref...). */
  sourceRef?: string | null;
  accountMask: string;
  postedDate: string; // yyyy-mm-dd
  amountCents: number;
  descriptionNorm: string;
}

/** A row already persisted (carries identity + any user edits to preserve). */
export interface StoredRecord extends IngestRecord {
  id: string;
  /** User hand-categorized/attributed this row — never clobber on re-import. */
  userOverridden?: boolean;
}

export type IngestAction =
  | { kind: 'insert'; record: IngestRecord }
  | { kind: 'replace'; targetId: string; record: IngestRecord; preserveUserData: boolean }
  | { kind: 'supersede'; targetId: string; record: IngestRecord; preserveUserData: boolean }
  | { kind: 'skip'; reason: 'duplicate' | 'lower-priority'; dedupeKey: string };

export interface ReconcilePlan {
  actions: IngestAction[];
  inserts: number;
  replaced: number;
  superseded: number;
  skipped: number;
}

/** Source trust order for collisions: live bank data beats PDF beats hand entry. */
const PRIORITY: Record<TxnSource, number> = { plaid: 3, pdf: 2, manual: 1 };

const FUZZY_DAY_WINDOW = 3;
const FUZZY_SIM_THRESHOLD = 0.6;

/**
 * Build the reconcile plan for a batch. `existing` is the current ledger slice
 * for the household (ideally pre-filtered to the affected accounts/date range).
 */
export function reconcileIngest(
  existing: StoredRecord[],
  incoming: IngestRecord[],
): ReconcilePlan {
  // Collapse duplicates *within* the batch first — keep the highest-priority
  // copy of each dedupe key so a single import can't fight itself.
  const batch = dedupeBatch(incoming);

  const byKey = new Map<string, StoredRecord>();
  for (const e of existing) byKey.set(e.dedupeKey, e);

  const actions: IngestAction[] = [];
  let inserts = 0;
  let replaced = 0;
  let superseded = 0;
  let skipped = 0;

  for (const rec of batch) {
    // 1. Exact canonical-key collision: same economic event, possibly a
    //    different (or upgraded) source.
    const exact = byKey.get(rec.dedupeKey);
    if (exact) {
      if (PRIORITY[rec.source] > PRIORITY[exact.source]) {
        actions.push({
          kind: 'replace',
          targetId: exact.id,
          record: rec,
          preserveUserData: !!exact.userOverridden,
        });
        replaced++;
      } else {
        actions.push({ kind: 'skip', reason: 'duplicate', dedupeKey: rec.dedupeKey });
        skipped++;
      }
      continue;
    }

    // 2. Fuzzy reconcile: the same purchase logged manually, then the import
    //    arrives with a slightly different date/description. Supersede the
    //    lower-or-equal-priority row and carry its category/attribution over.
    const fuzzy = findFuzzyMatch(existing, rec);
    if (fuzzy) {
      if (PRIORITY[rec.source] >= PRIORITY[fuzzy.source]) {
        actions.push({
          kind: 'supersede',
          targetId: fuzzy.id,
          record: rec,
          preserveUserData: !!fuzzy.userOverridden,
        });
        superseded++;
      } else {
        actions.push({ kind: 'skip', reason: 'lower-priority', dedupeKey: rec.dedupeKey });
        skipped++;
      }
      continue;
    }

    // 3. Genuinely new.
    actions.push({ kind: 'insert', record: rec });
    inserts++;
  }

  return { actions, inserts, replaced, superseded, skipped };
}

/** Keep one row per dedupe key in the incoming batch (highest source priority). */
function dedupeBatch(incoming: IngestRecord[]): IngestRecord[] {
  const best = new Map<string, IngestRecord>();
  for (const rec of incoming) {
    const cur = best.get(rec.dedupeKey);
    if (!cur || PRIORITY[rec.source] > PRIORITY[cur.source]) best.set(rec.dedupeKey, rec);
  }
  return [...best.values()];
}

function findFuzzyMatch(
  existing: StoredRecord[],
  rec: IngestRecord,
): StoredRecord | undefined {
  for (const e of existing) {
    if (e.accountMask !== rec.accountMask) continue;
    if (e.amountCents !== rec.amountCents) continue;
    if (Math.abs(daysBetween(e.postedDate, rec.postedDate)) > FUZZY_DAY_WINDOW) continue;
    if (descSimilarity(e.descriptionNorm, rec.descriptionNorm) < FUZZY_SIM_THRESHOLD) continue;
    return e;
  }
  return undefined;
}

/**
 * Token overlap coefficient (intersection / smaller set) of two normalized
 * descriptions. Unlike Jaccard, this rewards the common case where one source's
 * description is a richer superset of the other's ("DINNER" vs "DINNER
 * PURCHASE" => 1). The fuzzy gate already requires same account, exact amount,
 * and ±3 days, so a strong word overlap is a safe supersede signal.
 */
export function descSimilarity(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

function tokenSet(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
}

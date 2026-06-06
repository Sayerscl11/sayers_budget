// Persist a parsed statement into Supabase. Runs under the caller's RLS session
// (every write is scoped to their household), so it needs no service-role key.
// Flow: file-hash idempotency -> upsert accounts -> reconcile incoming vs.
// stored -> apply the insert/replace/supersede plan -> record the batch.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParseResult, RawTxn } from '@core/parser';
import { reconcileIngest, type IngestRecord, type StoredRecord } from './reconcile';

export interface IngestSummary {
  parsed: number;
  accounts: number;
  inserted: number;
  replaced: number;
  superseded: number;
  skipped: number;
  needsReview: number;
  alreadyImported: boolean;
}

export interface BatchMeta {
  source: 'pdf' | 'manual';
  fileHash?: string;
  filename?: string;
}

export async function ingestParseResult(
  supabase: SupabaseClient,
  householdId: string,
  parse: ParseResult,
  batch: BatchMeta,
): Promise<IngestSummary> {
  const needsReview = parse.transactions.filter((t) => t.needsReview).length;
  const empty = (alreadyImported: boolean): IngestSummary => ({
    parsed: parse.transactions.length,
    accounts: parse.accounts.length,
    inserted: 0,
    replaced: 0,
    superseded: 0,
    skipped: alreadyImported ? parse.transactions.length : 0,
    needsReview,
    alreadyImported,
  });

  // 0. Idempotency: re-uploading the same file is a complete no-op.
  if (batch.fileHash) {
    const { data: prior } = await supabase
      .from('import_batches')
      .select('id')
      .eq('household_id', householdId)
      .eq('file_hash', batch.fileHash)
      .maybeSingle();
    if (prior) return empty(true);
  }

  // 1. Upsert detected accounts; build mask <-> id maps.
  const maskToId = new Map<string, string>();
  for (const a of parse.accounts) {
    const { data } = await supabase
      .from('accounts')
      .upsert(
        { household_id: householdId, mask: a.mask, name: a.name, role: a.role },
        { onConflict: 'household_id,mask' },
      )
      .select('id, mask')
      .single();
    if (data) maskToId.set(data.mask as string, data.id as string);
  }
  const idToMask = new Map([...maskToId].map(([m, id]) => [id, m]));

  // 2. Load the household's current (non-superseded) ledger to reconcile against.
  const { data: existingRows } = await supabase
    .from('transactions')
    .select(
      'id, dedupe_key, source, source_ref, posted_date, amount_cents, ' +
        'description_norm, account_id, user_overridden',
    )
    .is('superseded_by', null);

  const existing: StoredRecord[] = ((existingRows ?? []) as unknown as Array<{
    id: string;
    dedupe_key: string;
    source: 'pdf' | 'manual' | 'plaid';
    source_ref: string | null;
    posted_date: string;
    amount_cents: number | string;
    description_norm: string;
    account_id: string | null;
    user_overridden: boolean;
  }>).map((r) => ({
    id: r.id,
    dedupeKey: r.dedupe_key,
    source: r.source,
    sourceRef: r.source_ref,
    accountMask: (r.account_id && idToMask.get(r.account_id)) || '',
    postedDate: r.posted_date,
    amountCents: Number(r.amount_cents),
    descriptionNorm: r.description_norm,
    userOverridden: r.user_overridden,
  }));

  // 3. Reconcile. Keep a key -> full RawTxn map so we can build DB rows.
  const byKey = new Map<string, RawTxn>();
  const incoming: IngestRecord[] = parse.transactions.map((t) => {
    byKey.set(t.dedupeKey, t);
    return {
      dedupeKey: t.dedupeKey,
      source: batch.source,
      sourceRef: null,
      accountMask: t.accountMask,
      postedDate: t.postedDate,
      amountCents: t.amountCents,
      descriptionNorm: t.descriptionNorm,
    };
  });
  const plan = reconcileIngest(existing, incoming);

  const toRow = (t: RawTxn) => ({
    household_id: householdId,
    account_id: maskToId.get(t.accountMask) ?? null,
    posted_date: t.postedDate,
    description_raw: t.descriptionRaw,
    description_norm: t.descriptionNorm,
    label: t.label,
    amount_cents: t.amountCents,
    running_balance_cents: t.runningBalanceCents,
    type: t.type,
    source: batch.source,
    source_ref: null,
    dedupe_key: t.dedupeKey,
    needs_review: t.needsReview,
  });

  // 4. Apply the plan. Inserts are batched; replace/supersede touch one row each.
  const insertRows: ReturnType<typeof toRow>[] = [];
  for (const action of plan.actions) {
    if (action.kind === 'insert') {
      insertRows.push(toRow(byKey.get(action.record.dedupeKey)!));
    } else if (action.kind === 'replace') {
      const row = toRow(byKey.get(action.record.dedupeKey)!);
      // Don't clobber a category the user set by hand on the row we're upgrading.
      const patch = action.preserveUserData ? withoutLabel(row) : row;
      await supabase.from('transactions').update(patch).eq('id', action.targetId);
    } else if (action.kind === 'supersede') {
      const { data: inserted } = await supabase
        .from('transactions')
        .insert(toRow(byKey.get(action.record.dedupeKey)!))
        .select('id')
        .single();
      if (inserted) {
        await supabase
          .from('transactions')
          .update({ superseded_by: inserted.id })
          .eq('id', action.targetId);
      }
    }
  }
  if (insertRows.length) await supabase.from('transactions').insert(insertRows);

  // 5. Record the batch (file-hash unique => future re-imports short-circuit).
  if (batch.fileHash) {
    await supabase.from('import_batches').insert({
      household_id: householdId,
      source: batch.source,
      file_hash: batch.fileHash,
      filename: batch.filename ?? null,
      row_count: parse.transactions.length,
      inserted: plan.inserts,
      superseded: plan.superseded,
      skipped: plan.skipped,
    });
  }

  return {
    parsed: parse.transactions.length,
    accounts: parse.accounts.length,
    inserted: plan.inserts,
    replaced: plan.replaced,
    superseded: plan.superseded,
    skipped: plan.skipped,
    needsReview,
    alreadyImported: false,
  };
}

function withoutLabel<T extends { label: unknown }>(row: T): Omit<T, 'label'> {
  const { label: _label, ...rest } = row;
  return rest;
}

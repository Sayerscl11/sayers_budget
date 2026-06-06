'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { parseStatement } from '@core/parser';
import { formatCurrency } from '@core/money';
import { createClient } from '@/lib/supabase/server';
import { useSupabaseData } from '@/lib/env';
import { getCurrentUser, getMembershipHousehold } from '@/lib/auth';
import { extractText } from '@/lib/pdf/extractText';
import { ingestParseResult, type IngestSummary } from '@/lib/ingest/persist';

export interface ImportResult {
  error?: string;
  /** Whether the rows were persisted (live mode) or just previewed (demo). */
  saved?: boolean;
  parsed?: number;
  accounts?: number;
  summary?: IngestSummary;
  warnings?: string[];
  sample?: { date: string; desc: string; amount: string }[];
}

export async function importStatement(
  _prev: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  // 1. Resolve the statement text from an uploaded PDF or pasted text.
  const file = formData.get('file');
  const pasted = String(formData.get('text') ?? '');
  let text = '';
  let fileHash: string | undefined;
  let filename: string | undefined;

  if (file instanceof File && file.size > 0) {
    const buf = new Uint8Array(await file.arrayBuffer());
    fileHash = createHash('sha256').update(buf).digest('hex');
    filename = file.name;
    try {
      text = await extractText(buf);
    } catch {
      return { error: 'Could not read that PDF. Try the text-paste option below.' };
    }
  } else if (pasted.trim()) {
    text = pasted;
  } else {
    return { error: 'Choose a PDF file or paste statement text first.' };
  }

  // 2. Parse (pure, deterministic).
  const parse = parseStatement(text);
  if (parse.transactions.length === 0) {
    return {
      error:
        'No transactions found. If this was a PDF, its layout may differ from ' +
        'what the parser expects — paste the text instead, or share a sample.',
    };
  }

  const sample = parse.transactions.slice(0, 8).map((t) => ({
    date: t.postedDate,
    desc: t.label || t.descriptionRaw,
    amount: formatCurrency(t.amountCents),
  }));

  // 3. Demo mode (no DB): preview only.
  if (!useSupabaseData()) {
    return {
      saved: false,
      parsed: parse.transactions.length,
      accounts: parse.accounts.length,
      warnings: parse.warnings,
      sample,
    };
  }

  // 4. Live mode: persist under the user's household (RLS-scoped).
  const user = await getCurrentUser();
  if (!user) return { error: 'Please sign in to save imports.' };
  const householdId = await getMembershipHousehold();
  if (!householdId) return { error: 'Finish setting up your household first.' };

  const supabase = await createClient();
  const summary = await ingestParseResult(supabase, householdId, parse, {
    source: file instanceof File && file.size > 0 ? 'pdf' : 'manual',
    fileHash,
    filename,
  });

  revalidatePath('/');
  revalidatePath('/transactions');

  return {
    saved: true,
    parsed: parse.transactions.length,
    accounts: parse.accounts.length,
    warnings: parse.warnings,
    summary,
    sample,
  };
}

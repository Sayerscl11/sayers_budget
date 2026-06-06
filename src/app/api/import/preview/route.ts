import { NextResponse } from 'next/server';
import { parseStatement } from '@core/parser';

export const runtime = 'nodejs';

/**
 * Parse pasted statement text into a preview. Stateless — nothing is persisted
 * here; commit-to-ledger lands with the Supabase ingest layer. PDF upload will
 * extend this route to extract text first, then run the same parser.
 */
export async function POST(req: Request) {
  let text: string | undefined;
  try {
    ({ text } = (await req.json()) as { text?: string });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'Paste statement text first.' }, { status: 400 });
  }

  const result = parseStatement(text);
  return NextResponse.json({
    accounts: result.accounts,
    warnings: result.warnings,
    count: result.transactions.length,
    transactions: result.transactions.slice(0, 200), // cap the preview payload
  });
}

'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@core/money';

interface PreviewRow {
  postedDate: string;
  descriptionRaw: string;
  label: string | null;
  amountCents: number;
  accountMask: string;
  needsReview: boolean;
}
interface Preview {
  accounts: { mask: string; name: string; role: string }[];
  warnings: string[];
  count: number;
  transactions: PreviewRow[];
}

export default function ImportPage() {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runPreview() {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch('/api/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to parse');
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 py-6">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Import a statement</h1>
      <p className="mb-4 text-xs text-slate-400">
        Paste the text of a Capital One 360 statement to preview the transactions.
        PDF upload and save-to-ledger arrive with the database layer.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste statement text here…"
        rows={6}
        className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />

      <button
        onClick={runPreview}
        disabled={loading || text.trim().length === 0}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {loading ? 'Parsing…' : 'Preview transactions'}
      </button>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {preview && (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            Parsed <strong>{preview.count}</strong> transactions across{' '}
            <strong>{preview.accounts.length}</strong> account
            {preview.accounts.length === 1 ? '' : 's'}.
          </div>

          {preview.warnings.length > 0 && (
            <details className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <summary className="cursor-pointer font-medium">
                {preview.warnings.length} parser warning
                {preview.warnings.length === 1 ? '' : 's'}
              </summary>
              <ul className="mt-2 list-disc pl-5 text-xs">
                {preview.warnings.slice(0, 20).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}

          <ul className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-100">
            {preview.transactions.slice(0, 50).map((t, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-14 shrink-0 text-[11px] text-slate-400">
                  {t.postedDate.slice(5)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                  {t.label || t.descriptionRaw}
                  {t.needsReview && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 text-[10px] text-amber-800">
                      review
                    </span>
                  )}
                </span>
                <span
                  className={`shrink-0 text-sm font-medium tabular-nums ${
                    t.amountCents < 0 ? 'text-slate-900' : 'text-emerald-600'
                  }`}
                >
                  {formatCurrency(t.amountCents)}
                </span>
              </li>
            ))}
          </ul>
          {preview.count > 50 && (
            <p className="text-center text-xs text-slate-400">
              Showing first 50 of {preview.count}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

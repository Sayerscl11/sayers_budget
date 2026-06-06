'use client';

import { useActionState, useRef, useState } from 'react';
import { Loader2, FileUp, CheckCircle2 } from 'lucide-react';
import { importStatement, type ImportResult } from './actions';

export default function ImportPage() {
  const [state, formAction, pending] = useActionState<ImportResult, FormData>(
    importStatement,
    {},
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="px-4 py-6">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Import a statement</h1>
      <p className="mb-4 text-xs text-slate-400">
        Upload a Capital One 360 PDF. Transactions are parsed, de-duplicated against
        what’s already saved, and added to your ledger.
      </p>

      <form action={formAction} className="space-y-3">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-4 py-8 text-center hover:border-brand/50">
          <FileUp size={24} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-600">
            {fileName ?? 'Choose a PDF statement'}
          </span>
          <span className="text-[11px] text-slate-400">Tap to browse</span>
          <input
            ref={fileRef}
            type="file"
            name="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>

        <details className="rounded-xl bg-white p-3 text-sm ring-1 ring-slate-100">
          <summary className="cursor-pointer text-slate-500">
            Or paste statement text
          </summary>
          <textarea
            name="text"
            rows={5}
            placeholder="Paste statement text…"
            className="mt-2 w-full resize-y rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </details>

        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending && <Loader2 size={16} className="animate-spin" />}
          {pending ? 'Working…' : 'Import statement'}
        </button>
      </form>

      {state.error && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>
      )}

      {(state.summary || state.saved === false) && <ResultCard state={state} />}
    </div>
  );
}

function ResultCard({ state }: { state: ImportResult }) {
  const s = state.summary;
  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
        <div>
          {state.saved ? (
            s?.alreadyImported ? (
              <p>This statement was already imported — nothing to add.</p>
            ) : (
              <p>
                Saved <strong>{s?.inserted ?? 0} new</strong>
                {s && s.superseded > 0 && <> · {s.superseded} merged</>}
                {s && s.skipped > 0 && <> · {s.skipped} already there</>} across{' '}
                {state.accounts} account{state.accounts === 1 ? '' : 's'}.
              </p>
            )
          ) : (
            <p>
              Parsed <strong>{state.parsed}</strong> transactions across{' '}
              {state.accounts} account{state.accounts === 1 ? '' : 's'}.{' '}
              <span className="text-emerald-700/70">
                (Demo mode — not saved. Go live to persist.)
              </span>
            </p>
          )}
          {s && s.needsReview > 0 && (
            <p className="mt-1 text-amber-700">
              {s.needsReview} row{s.needsReview === 1 ? '' : 's'} flagged for review.
            </p>
          )}
        </div>
      </div>

      {state.sample && state.sample.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-100">
          {state.sample.map((r, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-12 shrink-0 text-[11px] text-slate-400">
                {r.date.slice(5)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                {r.desc}
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums text-slate-900">
                {r.amount}
              </span>
            </li>
          ))}
        </ul>
      )}

      {state.warnings && state.warnings.length > 0 && (
        <details className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <summary className="cursor-pointer font-medium">
            {state.warnings.length} parser warning
            {state.warnings.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-2 list-disc pl-5 text-xs">
            {state.warnings.slice(0, 20).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { setTransactionLabel } from './actions';

/** Inline category editor for a discretionary row: tap to set/replace the label. */
export function CategoryTag({
  id,
  label,
  editable,
}: {
  id: string;
  label: string | null;
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label ?? '');

  if (!editable) {
    return <span className="text-[11px] text-slate-400">{label || 'Spending'}</span>;
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder="Category"
        className="w-24 rounded border border-slate-300 px-1.5 py-0.5 text-[11px] outline-none focus:border-brand"
      />
    );
  }

  function save() {
    setEditing(false);
    if (value.trim() === (label ?? '')) return;
    startTransition(async () => {
      await setTransactionLabel(id, value);
    });
  }

  const uncategorized = !label;
  return (
    <button
      onClick={() => setEditing(true)}
      disabled={pending}
      className={`rounded-full px-2 py-0.5 text-[11px] ${
        uncategorized
          ? 'bg-amber-100 text-amber-800'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      } ${pending ? 'opacity-50' : ''}`}
    >
      {label || 'Add category'}
    </button>
  );
}

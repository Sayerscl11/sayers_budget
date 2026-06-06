'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type { AuthState } from '@/app/(auth)/actions';

type Action = (prev: AuthState, formData: FormData) => Promise<AuthState>;

export function AuthForm({
  action,
  submitLabel,
  altHref,
  altPrompt,
  altLabel,
}: {
  action: Action;
  submitLabel: string;
  altHref: string;
  altPrompt: string;
  altLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-3">
      <input
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      <input
        name="password"
        type="password"
        autoComplete="current-password"
        required
        placeholder="Password"
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        {pending && <Loader2 size={16} className="animate-spin" />}
        {submitLabel}
      </button>

      <p className="pt-2 text-center text-sm text-slate-500">
        {altPrompt}{' '}
        <Link href={altHref} className="font-medium text-brand">
          {altLabel}
        </Link>
      </p>
    </form>
  );
}

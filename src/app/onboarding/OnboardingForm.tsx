'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { createHousehold } from './actions';

const input =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';
const label = 'mb-1 block text-xs font-medium text-slate-500';

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createHousehold, {});

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className={label} htmlFor="householdName">Household name</label>
        <input id="householdName" name="householdName" className={input} placeholder="Sayers" defaultValue="Sayers" />
      </div>
      <div>
        <label className={label} htmlFor="yourName">Your name</label>
        <input id="yourName" name="yourName" className={input} placeholder="Coty" required />
      </div>

      <div className="rounded-xl bg-slate-100/70 p-4">
        <p className="mb-3 text-xs font-medium text-slate-500">Invite your partner (optional)</p>
        <div className="space-y-3">
          <input name="partnerName" className={input} placeholder="Partner’s name (e.g. Kia)" />
          <input name="partnerEmail" type="email" className={input} placeholder="partner@example.com" />
        </div>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        {pending && <Loader2 size={16} className="animate-spin" />}
        Create household
      </button>
    </form>
  );
}

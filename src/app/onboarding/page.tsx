import { redirect } from 'next/navigation';
import { getCurrentUser, getMembershipHousehold } from '@/lib/auth';
import { useSupabaseData } from '@/lib/env';
import { OnboardingForm } from './OnboardingForm';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  // Onboarding only applies to the live (Supabase) app.
  if (!useSupabaseData()) redirect('/');
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (await getMembershipHousehold()) redirect('/');

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center bg-slate-50 px-6 py-10">
      <h1 className="text-xl font-bold text-slate-900">Set up your household</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        Both of you share one budget. Invite your partner by email and they’ll join
        this household when they sign up.
      </p>
      <OnboardingForm />
    </div>
  );
}

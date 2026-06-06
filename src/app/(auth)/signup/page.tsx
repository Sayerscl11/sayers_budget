import { AuthForm } from '@/components/auth/AuthForm';
import { signup } from '../actions';

export default function SignupPage() {
  return (
    <AuthForm
      action={signup}
      submitLabel="Create account"
      altPrompt="Already have an account?"
      altHref="/login"
      altLabel="Sign in"
    />
  );
}

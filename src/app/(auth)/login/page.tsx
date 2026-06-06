import { AuthForm } from '@/components/auth/AuthForm';
import { login } from '../actions';

export default function LoginPage() {
  return (
    <AuthForm
      action={login}
      submitLabel="Sign in"
      altPrompt="New here?"
      altHref="/signup"
      altLabel="Create an account"
    />
  );
}

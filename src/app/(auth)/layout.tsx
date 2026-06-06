export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center bg-slate-50 px-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-brand">Sayers Budget</h1>
        <p className="mt-1 text-sm text-slate-500">Weekly safe-to-spend for the household.</p>
      </div>
      {children}
    </div>
  );
}

import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 p-6">
        <h1 className="mb-1 text-lg font-semibold text-neutral-900">Deal Tracker</h1>
        <p className="mb-6 text-sm text-neutral-500">Enter the access password to continue.</p>
        <LoginForm />
      </div>
    </main>
  );
}

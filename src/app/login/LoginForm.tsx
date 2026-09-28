"use client";

import { useActionState } from "react";
import { authenticate } from "./actions";

export function LoginForm() {
  const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <input
        type="password"
        name="password"
        required
        autoFocus
        placeholder="Password"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        {isPending ? "Checking…" : "Sign in"}
      </button>
      {errorMessage && <p className="text-xs text-rose-600">{errorMessage}</p>}
    </form>
  );
}

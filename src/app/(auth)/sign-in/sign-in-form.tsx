"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  FormEvent,
  useCallback,
  useState,
  useTransition,
} from "react";

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);

      const formData = new FormData(event.currentTarget);
      const email = (formData.get("email") ?? "").toString().trim();
      const password = (formData.get("password") ?? "").toString();

      if (!email || !password) {
        setError("Email and password are required.");
        return;
      }

      startTransition(async () => {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          setError("Invalid email or password.");
          return;
        }

        router.push("/");
        router.refresh();
      });
    },
    [router]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-zinc-200/60 bg-white/90 p-6 shadow-lg dark:border-white/15 dark:bg-white/5"
    >
      <fieldset className="flex flex-col gap-1">
        <label
          htmlFor="email"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200 dark:border-white/20 dark:bg-white/10 dark:text-white dark:focus:border-white dark:focus:ring-white/30"
        />
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <label
          htmlFor="password"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200 dark:border-white/20 dark:bg-white/10 dark:text-white dark:focus:border-white dark:focus:ring-white/30"
        />
      </fieldset>
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
      >
        {isPending ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}

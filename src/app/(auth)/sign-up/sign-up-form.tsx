"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  FormEvent,
  useCallback,
  useState,
  useTransition,
} from "react";

type RegisterResponse = {
  error?: string;
  ok?: boolean;
};

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);

      const formData = new FormData(event.currentTarget);
      const name = (formData.get("name") ?? "").toString().trim();
      const email = (formData.get("email") ?? "").toString().trim();
      const password = (formData.get("password") ?? "").toString();
      const confirmPassword = (formData.get("confirmPassword") ?? "")
        .toString();

      if (!email || !password) {
        setError("Email and password are required.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      startTransition(async () => {
        try {
          const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password, name }),
          });

          const result = (await response.json()) as RegisterResponse;

          if (!response.ok) {
            setError(result.error ?? "Unable to create your account.");
            return;
          }

          await signIn("credentials", {
            email,
            password,
            redirect: false,
          });

          router.push("/");
          router.refresh();
        } catch {
          setError("Something went wrong, please try again.");
        }
      });
    },
    [router]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-6 shadow-sm"
    >
      <fieldset className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-zinc-900">
          Name <span className="text-xs text-zinc-500">(optional)</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
        />
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-zinc-900">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
        />
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <label
          htmlFor="password"
          className="text-sm font-medium text-zinc-900"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
        />
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <label
          htmlFor="confirmPassword"
          className="text-sm font-medium text-zinc-900"
        >
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200"
        />
      </fieldset>
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}

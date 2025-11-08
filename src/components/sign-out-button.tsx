"use client";

import { signOut } from "next-auth/react";
import { useTransition } from "react";

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(() =>
          signOut({
            callbackUrl: "/sign-in",
          })
        )
      }
      disabled={isPending}
      className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
    >
      {isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}

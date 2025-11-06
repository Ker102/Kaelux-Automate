import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-16">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Welcome back
        </h1>
        <p className="text-sm text-zinc-600">
          Enter your credentials to access your account.
        </p>
      </header>
      <SignInForm />
      <p className="text-center text-sm text-zinc-600">
        Don&apos;t have an account?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-700"
        >
          Create one
        </Link>
        .
      </p>
    </main>
  );
}

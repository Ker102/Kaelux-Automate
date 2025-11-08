import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Create Account",
};

export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-16 text-zinc-900 dark:text-zinc-50">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Create your account
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Start building AI-generated n8n workflows in minutes.
        </p>
      </header>
      <SignUpForm />
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-300">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-700 dark:text-white dark:hover:text-zinc-200"
        >
          Sign in
        </Link>
        .
      </p>
    </main>
  );
}

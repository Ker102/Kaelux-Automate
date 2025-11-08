import Link from "next/link";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  const userIdentifier = session?.user?.name ?? session?.user?.email;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-6 py-16">
      <section className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          AI n8n Workflow Builder
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
          Generate automation workflows with natural language.
        </h1>
        <p className="max-w-2xl text-lg text-zinc-600">
          Sign in to start describing workflows you need. We&apos;ll use the
          best AI tooling and a curated template library to produce ready-to-run
          n8n JSON definitions.
        </p>
      </section>

      {session ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-white/15 dark:bg-white/5">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
            Welcome, {userIdentifier}
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Open the embedded n8n canvas to decide where the AI side panel
            should live. Once you&apos;re done exploring, use the sign-out
            button to switch accounts.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/builder"
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              Open n8n builder preview
            </Link>
            <SignOutButton />
          </div>
        </section>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/sign-in"
            className="rounded-2xl border border-zinc-200 bg-white px-6 py-8 shadow-sm transition hover:border-zinc-400"
          >
            <h3 className="text-lg font-semibold text-zinc-900">
              Sign in to your account
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              Access saved workflows, prompt history, and AI-generated
              automations.
            </p>
          </Link>
          <Link
            href="/sign-up"
            className="rounded-2xl border border-zinc-200 bg-white px-6 py-8 shadow-sm transition hover:border-zinc-400"
          >
            <h3 className="text-lg font-semibold text-zinc-900">
              Create a new account
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              Get started for free, explore workflow templates, and upgrade when
              you need more power.
            </p>
          </Link>
        </section>
      )}
    </main>
  );
}

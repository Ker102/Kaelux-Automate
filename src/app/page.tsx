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
        <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">
            Welcome, {userIdentifier}
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Your account is ready. Next up, we&apos;ll wire in the workflow
            builder and vector-enhanced prompting.
          </p>
          <div className="mt-6">
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

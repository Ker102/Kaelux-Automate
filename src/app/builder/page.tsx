import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

const N8N_BASE_URL =
  process.env.NEXT_PUBLIC_N8N_BASE_URL ?? "http://localhost:5678";

export const metadata = {
  title: "Workflow Builder Preview",
  description: "Use the stock n8n editor as our starting point.",
};

export const dynamic = "force-dynamic";

export default async function BuilderPage() {
  const session = await auth();

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-12 text-zinc-900 dark:text-zinc-50">
      <section className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Workflow Builder Template
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Original n8n editor embedded for reference.
        </h1>
        <p className="max-w-3xl text-base text-zinc-600 dark:text-zinc-300">
          We&apos;re rendering the stock n8n interface directly inside the app
          so it&apos;s easy to map where the AI side panel should live (next to
  the Logs area) and evaluate the DOM hierarchy before we start customizing.
        </p>
        <div className="rounded-2xl border border-zinc-200/70 bg-white/80 p-4 text-sm shadow-lg dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
          <p className="font-medium text-zinc-800 dark:text-white">
            Getting this view running
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
            <li>
              Start the bundled container:{" "}
              <code className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                docker compose -f docker-compose.dev.yml up -d n8n
              </code>
            </li>
            <li>
              (Optional) sign in to n8n at{" "}
              <Link
                href={`${N8N_BASE_URL}/signin`}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:text-zinc-900 dark:hover:text-white"
              >
                {N8N_BASE_URL}
              </Link>{" "}
              and finish the onboarding wizard so workflows load correctly.
            </li>
            <li>
              Reload this page once the editor is ready. If the frame below
              stays blank, verify the container is running and that
              <code className="ml-1 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                NEXT_PUBLIC_N8N_BASE_URL
              </code>{" "}
              points to the right host.
            </li>
          </ol>
        </div>
      </section>

      <section className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Live editor preview (read-only for now)
          </h2>
          <Link
            href={`${N8N_BASE_URL}/workflow`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-400 hover:text-black dark:border-white/20 dark:text-white"
          >
            Open in new tab
          </Link>
        </div>
        <div className="min-h-[600px] overflow-hidden rounded-3xl border border-zinc-200 shadow-2xl dark:border-white/10">
          <iframe
            src={`${N8N_BASE_URL}/workflow`}
            className="h-[75vh] min-h-[600px] w-full bg-black/90"
            allowFullScreen
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
            title="n8n editor"
          />
        </div>
      </section>
    </main>
  );
}

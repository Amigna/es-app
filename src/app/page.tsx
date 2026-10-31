import Link from "next/link";
import VerbSearch from "@/components/VerbSearch";
import { VERBS, verbSlug } from "@/lib/verbs";

export default function Home() {
  const sorted = [...VERBS].sort((a, b) => a.inf.localeCompare(b.inf, "es"));

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Look up any verb</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Every tense and mood, for Latin American and Caribbean Spanish. Search in Spanish or English.
        </p>
        <VerbSearch autoFocus />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Browse verbs</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((v) => (
            <li key={v.inf}>
              <Link
                href={`/verb/${verbSlug(v.inf)}`}
                className="flex items-baseline justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 transition hover:border-emerald-600 dark:border-zinc-800"
              >
                <span className="font-medium">{v.inf}</span>
                <span className="truncate text-sm text-zinc-500">{v.en.replace(/^to /, "")}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { READINGS } from "@/lib/reading-data";
import { LEVELS } from "@/lib/readings";

export const metadata: Metadata = { title: "Reading · Conjugar" };

export default function ReadingPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Reading</h1>
        <p className="text-stone-600 dark:text-stone-400">
          Short stories from across Latin America and the Caribbean, each with a translation, key words and questions.
        </p>
      </header>

      {LEVELS.map((level) => (
        <section key={level.id}>
          <h2 className="text-xl font-semibold">
            {level.id} · {level.name}
          </h2>
          <p className="mb-3 text-sm text-stone-500">{level.grammar}</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {READINGS.filter((r) => r.level === level.id).map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/reading/${r.slug}`}
                  className="block h-full rounded-xl border border-stone-200 bg-white p-4 transition hover:border-accent-600 dark:border-stone-800 dark:bg-stone-900"
                >
                  <span lang="es" className="block text-lg font-semibold">
                    {r.title}
                  </span>
                  <span className="mt-1 block text-stone-600 dark:text-stone-400">
                    {r.en} · <span lang="es">{r.place}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

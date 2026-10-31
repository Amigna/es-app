import type { Metadata } from "next";
import { REGIONAL } from "@/lib/guides";

export const metadata: Metadata = { title: "Regional words · Conjugar" };

const TOPICS = ["careful", "getting around", "food", "home", "everyday things", "slang"];
const TITLES: Record<string, string> = {
  careful: "Be careful with these",
  "getting around": "Getting around",
  food: "Food and drink",
  home: "Around the house",
  "everyday things": "Everyday things",
  slang: "Slang",
};

export default function RegionalPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Regional words</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          The same thing can have a different name from country to country, and a word that&apos;s fine in one place can be
          rude in another.
        </p>
      </header>

      {TOPICS.map((topic) => (
        <section key={topic}>
          <h2 className="mb-3 text-xl font-semibold">{TITLES[topic]}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {REGIONAL.filter((r) => r.topic === topic).map((r) => (
              <article key={r.en} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="font-semibold">{r.en}</h3>
                <dl className="mt-2 space-y-1">
                  {r.words.map((w) => (
                    <div key={w.es} className="grid grid-cols-[8rem_1fr] gap-3">
                      <dt lang="es" className="font-medium">
                        {w.es}
                      </dt>
                      <dd className="text-sm text-zinc-500">{w.where}</dd>
                    </div>
                  ))}
                </dl>
                {r.note && <p className="mt-2 text-sm italic text-zinc-600 dark:text-zinc-400">{r.note}</p>}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

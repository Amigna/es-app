import type { CSSProperties } from "react";
import Link from "next/link";
import VerbSearch from "@/components/VerbSearch";
import { VERBS, verbSlug } from "@/lib/verbs";

// A hue per verb ending, for the edge of each verb card.
const ENDINGS = [
  { id: "ar", hue: 35 },
  { id: "er", hue: 235 },
  { id: "ir", hue: 300 },
] as const;

const SHORTCUTS = [
  { href: "/drill", title: "Practice", note: "Drills, flashcards and today's review", hue: 325 },
  { href: "/reading", title: "Read", note: "Short stories from across the region", hue: 270 },
  { href: "/guides", title: "Learn", note: "Grammar guides with quizzes", hue: 205 },
] as const;

const hueStyle = (hue: number) => ({ "--hue": hue }) as CSSProperties;

const endingOf = (inf: string) => (inf.replace(/se$/, "").endsWith("ar") ? "ar" : inf.replace(/se$/, "").endsWith("er") ? "er" : "ir");

export default function Home() {
  const sorted = [...VERBS].sort((a, b) => a.inf.localeCompare(b.inf, "es"));
  const hue = Object.fromEntries(ENDINGS.map((e) => [e.id, e.hue]));

  return (
    <div className="space-y-10">
      <section className="hero space-y-4 rounded-2xl px-5 py-8 sm:px-8">
        <h1 className="text-4xl font-semibold tracking-tight">Look up any verb</h1>
        <p className="text-stone-700 dark:text-stone-300">
          Every tense and mood, for Latin American and Caribbean Spanish. Search in Spanish or English.
        </p>
        <VerbSearch autoFocus />
      </section>

      <ul className="grid gap-3 sm:grid-cols-3">
        {SHORTCUTS.map((s) => (
          <li key={s.href} style={hueStyle(s.hue)}>
            <Link
              href={s.href}
              className="block h-full rounded-xl border border-accent-200 bg-accent-50 p-4 transition hover:border-accent-500 dark:border-accent-900 dark:bg-accent-950"
            >
              <span className="block text-lg font-semibold text-accent-800 dark:text-accent-200">{s.title} →</span>
              <span className="block text-sm text-stone-600 dark:text-stone-400">{s.note}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="font-display text-2xl font-semibold">Browse verbs</h2>
          <p className="flex gap-4 text-sm text-stone-600 dark:text-stone-400">
            {ENDINGS.map((e) => (
              <span key={e.id} style={hueStyle(e.hue)} className="flex items-center gap-1.5">
                <span aria-hidden className="h-4 w-1 rounded-full bg-accent-500" />-{e.id} verbs
              </span>
            ))}
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((v) => (
            <li key={v.inf} className="min-w-0" style={hueStyle(hue[endingOf(v.inf)])}>
              <Link
                href={`/verb/${verbSlug(v.inf)}`}
                className="flex items-baseline justify-between gap-3 rounded-lg border border-l-4 border-stone-200 border-l-accent-500 bg-white px-3 py-2 transition hover:border-accent-500 hover:bg-accent-50 dark:border-stone-800 dark:border-l-accent-600 dark:bg-stone-900 dark:hover:bg-accent-950"
              >
                <span className="shrink-0 font-medium">{v.inf}</span>
                <span className="truncate text-sm text-stone-500">{v.en.replace(/^to /, "")}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

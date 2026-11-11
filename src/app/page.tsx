import type { CSSProperties } from "react";
import Link from "next/link";
import CourseShortcut from "@/components/CourseShortcut";
import VerbSearch from "@/components/VerbSearch";
import { verbGroup, type VerbGroup } from "@/lib/conjugation/regular";
import { ESSENTIAL_COUNT, VERBS, verbSlug, type Verb } from "@/lib/verbs";

// A hue per verb ending, for the edge of each verb card.
const ENDINGS = [
  { id: "ar", hue: 35 },
  { id: "er", hue: 235 },
  { id: "ir", hue: 300 },
] as const;

// From the pattern to the exceptions, in the order they're usually learned.
const GROUPS: { id: VerbGroup; title: string; note: string }[] = [
  {
    id: "regular",
    title: "Regular",
    note: "Follow hablar, comer or vivir. Some change a letter to keep the sound, like busqué and llegué.",
  },
  {
    id: "stem",
    title: "Stem-changing",
    note: "The stem's vowel changes in some forms, like pienso, duermo and pido.",
  },
  {
    id: "irregular",
    title: "Irregular",
    note: "Forms that break the pattern, like tengo, hice and conozco, or a past participle like escrito.",
  },
];

const SHORTCUTS = [
  {
    href: "/drill",
    title: "Practice",
    note: "Drills, flashcards and today's review",
    hue: 325,
  },
  {
    href: "/reading",
    title: "Read",
    note: "Short stories from across the region",
    hue: 270,
  },
  {
    href: "/guides",
    title: "Learn",
    note: "Grammar guides with quizzes",
    hue: 205,
  },
] as const;

// The course's nav hue. Its card is drawn in the browser, since it depends on progress saved there.
const COURSE_HUE = 105;

const shortcutClass =
  "block h-full rounded-xl border border-accent-200 bg-accent-50 p-4 transition hover:border-accent-500 dark:border-accent-900 dark:bg-accent-950";

const hueStyle = (hue: number) => ({ "--hue": hue }) as CSSProperties;

const endingOf = (inf: string) =>
  inf.replace(/se$/, "").endsWith("ar")
    ? "ar"
    : inf.replace(/se$/, "").endsWith("er")
      ? "er"
      : "ir";

const byName = (a: Verb, b: Verb) => a.inf.localeCompare(b.inf, "es");

const SECTIONS = [
  { id: "common", title: "Essential verbs", verbs: VERBS.slice(0, ESSENTIAL_COUNT) },
  { id: "rest", title: "All other verbs", verbs: VERBS.slice(ESSENTIAL_COUNT) },
].map((section) => {
  const sorted = [...section.verbs].sort(byName);
  return {
    ...section,
    groups: GROUPS.map((g) => ({ ...g, id: `${section.id}-${g.id}`, verbs: sorted.filter((v) => verbGroup(v) === g.id) })),
  };
});

const pillClass =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full border border-stone-300 px-4 transition hover:border-stone-500 hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800";

export default function Home() {
  const hue = Object.fromEntries(ENDINGS.map((e) => [e.id, e.hue]));

  return (
    <div className="space-y-10">
      <section className="hero space-y-4 rounded-2xl px-5 py-8 sm:px-8">
        <h1 className="text-4xl font-semibold tracking-tight">
          Look up any verb
        </h1>
        <p className="text-stone-700 dark:text-stone-300">
          Every tense and mood, for Latin American and Caribbean Spanish. Search
          in Spanish or English.
        </p>
        <VerbSearch autoFocus />
      </section>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <li style={hueStyle(COURSE_HUE)}>
          <CourseShortcut className={shortcutClass} />
        </li>
        {SHORTCUTS.map((s) => (
          <li key={s.href} style={hueStyle(s.hue)}>
            <Link
              href={s.href}
              className={shortcutClass}
            >
              <span className="block text-lg font-semibold text-accent-800 dark:text-accent-200">
                {s.title} →
              </span>
              <span className="block text-sm text-stone-600 dark:text-stone-400">
                {s.note}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="font-display text-2xl font-semibold">
            Browse verbs{" "}
            <span className="text-base font-normal text-stone-500">
              ({VERBS.length})
            </span>
          </h2>
          <p className="flex gap-4 text-sm text-stone-600 dark:text-stone-400">
            {ENDINGS.map((e) => (
              <span
                key={e.id}
                style={hueStyle(e.hue)}
                className="flex items-center gap-1.5"
              >
                <span
                  aria-hidden
                  className="h-4 w-1 rounded-full bg-accent-500"
                />
                -{e.id} verbs
              </span>
            ))}
          </p>
        </div>
        <nav aria-label="Verb groups" className="mb-6 space-y-2 text-sm">
          {SECTIONS.filter((s) => s.id === "rest").map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2">
              <span className="w-full font-medium sm:w-40">{s.title}</span>
              {s.groups.map((g) => (
                <a key={g.id} href={`#${g.id}`} className={pillClass}>
                  {g.title} <span className="text-stone-500">{g.verbs.length}</span>
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="space-y-12">
          {SECTIONS.map((s) => (
            <section key={s.id} aria-labelledby={`${s.id}-title`} className="space-y-8">
              <div>
                <h2 id={`${s.id}-title`} className="font-display text-2xl font-semibold">
                  {s.title}{" "}
                  <span className="text-base font-normal text-stone-500">
                    ({s.verbs.length})
                  </span>
                </h2>
                {s.id === "common" && (
                  <p className="text-sm text-stone-600 dark:text-stone-400">
                    The most common verbs plus everyday ones like comer, comprar and cantar, listed A to Z.
                  </p>
                )}
              </div>
              {s.groups.map((g) => (
                <section
                  key={g.id}
                  id={g.id}
                  aria-labelledby={`${g.id}-title`}
                  className="scroll-mt-20"
                >
                  <h3 id={`${g.id}-title`} className="text-lg font-semibold">
                    {g.title}{" "}
                    <span className="text-sm font-normal text-stone-500">
                      {g.verbs.length}
                    </span>
                  </h3>
                  <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
                    {g.note}
                  </p>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {g.verbs.map((v) => (
                      <li
                        key={v.inf}
                        className="min-w-0"
                        style={hueStyle(hue[endingOf(v.inf)])}
                      >
                        <Link
                          href={`/verb/${verbSlug(v.inf)}`}
                          className="flex items-baseline justify-between gap-3 rounded-lg border border-l-4 border-stone-200 border-l-accent-500 bg-white px-3 py-2 transition hover:border-accent-500 hover:bg-accent-50 dark:border-stone-800 dark:border-l-accent-600 dark:bg-stone-900 dark:hover:bg-accent-950"
                        >
                          <span className="shrink-0 font-medium">{v.inf}</span>
                          <span className="truncate text-sm text-stone-500">
                            {v.en.replace(/^to /, "")}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

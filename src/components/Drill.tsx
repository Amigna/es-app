"use client";

import { useMemo, useState } from "react";
import DrillRunner from "@/components/DrillRunner";
import { TENSES, type Mood } from "@/lib/conjugation/types";
import { conjugationCard, makeQuestion, poolVerbs, type Card, type VerbPool } from "@/lib/drill";
import { NOUN_TOPICS, useDrillSettings, type Mode, type VocabKind, type WordType } from "@/lib/drill-settings";
import { findSentence } from "@/lib/sentences";
import { VERBS } from "@/lib/verbs";

const MODES: { id: Mode; title: string; hint: string }[] = [
  { id: "conjugation", title: "Conjugation", hint: "Type the verb form" },
  { id: "blanks", title: "Fill in the blank", hint: "Complete a real sentence" },
  { id: "vocabulary", title: "Vocabulary", hint: "Words, gender and agreement" },
  { id: "grammar", title: "Grammar", hint: "Quizzes from the guides" },
];

const MOODS: { id: Mood; title: string }[] = [
  { id: "indicative", title: "Indicative" },
  { id: "subjunctive", title: "Subjunctive" },
  { id: "imperative", title: "Imperative" },
];

const POOLS: { id: VerbPool; title: string; hint: string }[] = [
  { id: "common", title: "Most common", hint: "The top 50 verbs" },
  { id: "irregular", title: "Irregular", hint: "Irregular and stem-changing" },
  { id: "all", title: "All verbs", hint: `All ${VERBS.length} verbs` },
];

const VOCAB_OPTIONS: { id: VocabKind; title: string; hint: string }[] = [
  { id: "toSpanish", title: "English to Spanish", hint: "See the meaning, type the word" },
  { id: "toEnglish", title: "Spanish to English", hint: "See the word, type the meaning" },
  { id: "gender", title: "Noun gender", hint: "Choose el or la" },
  { id: "agreement", title: "Adjective agreement", hint: "Type the right form" },
];

const WORD_TYPES: { id: WordType; title: string; hint: string }[] = [
  { id: "noun", title: "Nouns", hint: "Can be limited by topic" },
  { id: "adjective", title: "Adjectives", hint: "Describing words" },
  { id: "adverb", title: "Adverbs", hint: "Time, place and manner" },
];

function OptionCard({
  name,
  title,
  hint,
  checked,
  type = "radio",
  onChange,
}: {
  name: string;
  title: string;
  hint: string;
  checked: boolean;
  type?: "radio" | "checkbox";
  onChange: () => void;
}) {
  return (
    <label
      className={`cursor-pointer rounded-lg border px-3 py-2 transition ${
        checked ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950" : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <input type={type} name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span className="block font-medium">{title}</span>
      <span className="block text-sm text-zinc-500">{hint}</span>
    </label>
  );
}

const toggled = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

export default function Drill({ rare, guideList }: { rare: string[]; guideList: { slug: string; title: string }[] }) {
  const rareSet = useMemo(() => new Set(rare), [rare]);

  const [settings, update] = useDrillSettings();
  const { mode, pool, tenses, kinds, wordTypes, topics, guides } = settings;
  const [session, setSession] = useState<{ first: Card; next: () => Card | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function buildDeck(): Promise<() => Card | null> {
    const verbs = poolVerbs(VERBS, pool);
    if (mode === "conjugation") {
      const { SENTENCE_GROUPS } = await import("@/lib/sentence-data");
      return () => {
        const q = makeQuestion(verbs, tenses, rareSet);
        return q && conjugationCard(q, findSentence(SENTENCE_GROUPS, q.verb.inf, q.tense));
      };
    }
    if (mode === "grammar") {
      const [{ quizDeck }, { GUIDE_QUIZZES }] = await Promise.all([import("@/lib/quiz"), import("@/lib/quiz-data")]);
      const chosen = guides.length ? guideList.filter((g) => guides.includes(g.slug)) : guideList;
      return quizDeck(GUIDE_QUIZZES, chosen);
    }
    const decks = await import("@/lib/card-decks");
    if (mode === "vocabulary") return decks.vocabDeck({ kinds, wordTypes, topics });
    const { SENTENCE_GROUPS } = await import("@/lib/sentence-data");
    return decks.blankDeck(SENTENCE_GROUPS, verbs, tenses);
  }

  async function start() {
    setError("");
    setLoading(true);
    try {
      const next = await buildDeck();
      const first = next();
      if (first) setSession({ first, next });
      else setError("No questions match that choice. Try selecting more options.");
    } catch {
      setError("Couldn't load the drill. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (session) return <DrillRunner first={session.first} next={session.next} onStop={() => setSession(null)} />;

  const usesVerbs = mode === "conjugation" || mode === "blanks";
  const ready = mode === "grammar" || (usesVerbs ? tenses.length > 0 : kinds.length > 0 && wordTypes.length > 0);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-xl font-semibold">What to practice</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {MODES.map((m) => (
            <OptionCard key={m.id} name="mode" title={m.title} hint={m.hint} checked={mode === m.id} onChange={() => update({ mode: m.id })} />
          ))}
        </div>
      </section>

      {mode === "grammar" && (
        <section>
          <h2 className="mb-1 text-xl font-semibold">Which guides?</h2>
          <p className="mb-3 text-sm text-zinc-500">Pick any, or leave them all off for every guide.</p>
          <div className="flex flex-wrap gap-2">
            {guideList.map((g) => (
              <button
                key={g.slug}
                type="button"
                aria-pressed={guides.includes(g.slug)}
                onClick={() => update({ guides: toggled(guides, g.slug) })}
                className={`min-h-10 rounded-full border px-3 py-1 text-sm transition ${
                  guides.includes(g.slug)
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : "border-zinc-200 hover:border-emerald-600 dark:border-zinc-700"
                }`}
              >
                {g.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {usesVerbs && (
        <>
          <section>
            <h2 className="mb-3 text-xl font-semibold">Which verbs?</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {POOLS.map((p) => (
                <OptionCard key={p.id} name="pool" title={p.title} hint={p.hint} checked={pool === p.id} onChange={() => update({ pool: p.id })} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">Which tenses?</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {MOODS.map((mood) => (
                <fieldset key={mood.id}>
                  <legend className="mb-2 font-medium">{mood.title}</legend>
                  <div>
                    {TENSES.filter((t) => t.mood === mood.id).map((t) => (
                      <label key={t.id} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={tenses.includes(t.id)}
                          onChange={() => update({ tenses: toggled(tenses, t.id) })}
                          className="size-4 accent-emerald-700"
                        />
                        {t.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </section>
        </>
      )}

      {mode === "vocabulary" && (
        <>
          <section>
            <h2 className="mb-3 text-xl font-semibold">Which questions?</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {VOCAB_OPTIONS.map((k) => (
                <OptionCard
                  key={k.id}
                  name={k.id}
                  type="checkbox"
                  title={k.title}
                  hint={k.hint}
                  checked={kinds.includes(k.id)}
                  onChange={() => update({ kinds: toggled(kinds, k.id) })}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">Which words?</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {WORD_TYPES.map((w) => (
                <OptionCard
                  key={w.id}
                  name={w.id}
                  type="checkbox"
                  title={w.title}
                  hint={w.hint}
                  checked={wordTypes.includes(w.id)}
                  onChange={() => update({ wordTypes: toggled(wordTypes, w.id) })}
                />
              ))}
            </div>
          </section>

          {wordTypes.includes("noun") && (
            <section>
              <h2 className="mb-1 text-xl font-semibold">Noun topics</h2>
              <p className="mb-3 text-sm text-zinc-500">Pick any, or leave them all off for every topic.</p>
              <div className="flex flex-wrap gap-2">
                {NOUN_TOPICS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={topics.includes(t)}
                    onClick={() => update({ topics: toggled(topics, t) })}
                    className={`min-h-10 rounded-full border px-3 py-1 text-sm capitalize transition ${
                      topics.includes(t)
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-zinc-200 hover:border-emerald-600 dark:border-zinc-700"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={start}
        disabled={!ready || loading}
        className="h-12 rounded-xl bg-emerald-700 px-6 font-medium text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Loading…" : "Start drilling"}
      </button>
    </div>
  );
}

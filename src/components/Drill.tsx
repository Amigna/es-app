"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DrillRunner from "@/components/DrillRunner";
import { TENSES, type Mood, type TenseId } from "@/lib/conjugation/types";
import { CORE_TENSES, conjugationCard, limitedDeck, makeQuestion, poolVerbs, type Card, type VerbPool } from "@/lib/drill";
import { NOUN_TOPICS, useDrillSettings, type CardType, type FlashSide, type Mode, type VocabKind, type WordType } from "@/lib/drill-settings";
import { parsePractice, type PracticeTarget } from "@/lib/practice";
import { progressEnabled } from "@/lib/progress-queue";
import { shuffled } from "@/lib/quiz";
import { itemVerbs, loadSentences } from "@/lib/sentence-loader";
import { sentencesFor } from "@/lib/sentences";
import { VERBS, findVerb, type Verb } from "@/lib/verbs";

const PRACTICE_SIZE = 15;
const FLASHCARD_SESSION = 20;

const MODES: { id: Mode; title: string; hint: string }[] = [
  { id: "review", title: "Today's review", hint: "What's due, plus new items" },
  { id: "conjugation", title: "Conjugation", hint: "Type the verb form" },
  { id: "blanks", title: "Fill in the blank", hint: "Complete a real sentence" },
  { id: "vocabulary", title: "Vocabulary", hint: "Words, gender and agreement" },
  { id: "flashcards", title: "Flashcards", hint: "Flip words and phrases" },
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
  { id: "small", title: "Small words", hint: "Prepositions, conjunctions, pronouns, question words" },
];

const FLASH_SIDES: { id: FlashSide; title: string; hint: string }[] = [
  { id: "toEnglish", title: "Spanish to English", hint: "See the Spanish, recall the meaning" },
  { id: "toSpanish", title: "English to Spanish", hint: "See the meaning, recall the Spanish" },
];

const FLASH_TYPES: { id: CardType; title: string; hint: string }[] = [
  ...WORD_TYPES,
  { id: "phrase", title: "Phrases", hint: "Everyday expressions" },
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

type Today = { status: "loading" } | { status: "signedOut" } | { status: "failed" } | { status: "ready"; reviews: string[]; fresh: string[] };

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Firebase stays out of this page's bundle, so it only loads for invited people who open this mode. */
async function loadTodayPlan(rare: Set<string>): Promise<Today> {
  if (!progressEnabled()) return { status: "signedOut" };
  try {
    const { prepareToday } = await import("@/lib/today");
    const plan = await prepareToday(rare);
    return plan ? { status: "ready", ...plan } : { status: "signedOut" };
  } catch (err) {
    console.error("Couldn't load today's review", err);
    return { status: "failed" };
  }
}

function TodaySummary({ today }: { today: Today }) {
  if (today.status === "loading") return <p className="text-zinc-500">Loading…</p>;
  if (today.status === "failed") return <p role="alert">Couldn&apos;t load today&apos;s review. Check your connection and try again.</p>;
  if (today.status === "signedOut") {
    return (
      <p className="text-zinc-600 dark:text-zinc-400">
        Today&apos;s review needs saved progress, which is invite-only for now.{" "}
        <Link href="/account" prefetch={false} className="text-emerald-700 underline dark:text-emerald-400">
          Sign in
        </Link>{" "}
        to use it.
      </p>
    );
  }
  if (today.reviews.length + today.fresh.length === 0) {
    return <p className="text-zinc-600 dark:text-zinc-400">All done for today. New reviews will be ready tomorrow.</p>;
  }
  return (
    <p className="text-zinc-600 dark:text-zinc-400">
      {plural(today.reviews.length, "review")} and {plural(today.fresh.length, "new item")} today.
    </p>
  );
}

export default function Drill({ rare, guideList }: { rare: string[]; guideList: { slug: string; title: string }[] }) {
  const rareSet = useMemo(() => new Set(rare), [rare]);

  const [settings, update] = useDrillSettings();
  const { mode, pool, tenses, kinds, wordTypes, topics, guides, flashSide, flashTypes } = settings;
  const [session, setSession] = useState<{ first: Card; next: () => Card | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [today, setToday] = useState<Today>({ status: "loading" });

  // Runs again after a session, because answering changes what's left.
  useEffect(() => {
    if (mode !== "review" || session) return;
    let current = true;
    loadTodayPlan(rareSet).then((plan) => {
      if (current) setToday(plan);
    });
    return () => {
      current = false;
    };
  }, [mode, session, rareSet]);

  async function conjugationDeck(verbs: Verb[], chosen: TenseId[]): Promise<() => Card | null> {
    const bank = await loadSentences(verbs);
    return () => {
      const q = makeQuestion(verbs, chosen, rareSet);
      return q && conjugationCard(q, sentencesFor(bank, q.verb.inf, q.tense));
    };
  }

  /** A short session from the progress page. It leaves the saved drill settings alone. */
  async function practiceDeck(target: PracticeTarget): Promise<() => Card | null> {
    if ("kind" in target) {
      const { vocabDeck } = await import("@/lib/card-decks");
      return vocabDeck({ kinds: [target.kind], wordTypes: ["noun", "adjective", "adverb", "small"], topics: [] });
    }
    if ("verb" in target) {
      const verb = findVerb(target.verb);
      return conjugationDeck(verb ? [verb] : [], CORE_TENSES);
    }
    return conjugationDeck(poolVerbs(VERBS, pool), target.tenses);
  }

  async function buildDeck(): Promise<() => Card | null> {
    if (mode === "review") {
      const plan = await loadTodayPlan(rareSet);
      if (plan.status !== "ready") return () => null;
      const items = [...shuffled(plan.reviews), ...plan.fresh];
      const [{ reviewDeck }, bank] = await Promise.all([import("@/lib/card-decks"), loadSentences(itemVerbs(items))]);
      return reviewDeck(items, bank, rareSet);
    }
    const verbs = poolVerbs(VERBS, pool);
    if (mode === "conjugation") return conjugationDeck(verbs, tenses);
    if (mode === "grammar") {
      const [{ quizDeck }, { GUIDE_QUIZZES }] = await Promise.all([import("@/lib/quiz"), import("@/lib/quiz-data")]);
      const chosen = guides.length ? guideList.filter((g) => guides.includes(g.slug)) : guideList;
      return quizDeck(GUIDE_QUIZZES, chosen);
    }
    const decks = await import("@/lib/card-decks");
    if (mode === "vocabulary") return decks.vocabDeck({ kinds, wordTypes, topics });
    if (mode === "flashcards") return limitedDeck(decks.flashcardDeck({ side: flashSide, types: flashTypes, topics }), FLASHCARD_SESSION);
    return decks.blankDeck(await loadSentences(verbs), verbs, tenses);
  }

  async function start(target?: PracticeTarget) {
    setError("");
    setLoading(true);
    try {
      const next = target ? limitedDeck(await practiceDeck(target), PRACTICE_SIZE) : await buildDeck();
      const first = next();
      if (first) setSession({ first, next });
      else setError("No questions match that choice. Try selecting more options.");
    } catch {
      setError("Couldn't load the drill. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // "Practice this" links land here. The address is cleared so reloading doesn't restart it, and "Done" shows the normal page.
  useEffect(() => {
    const target = parsePractice(window.location.search);
    if (!target) return;
    window.history.replaceState(null, "", "/drill");
    queueMicrotask(() => start(target));
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (session) return <DrillRunner first={session.first} next={session.next} onStop={() => setSession(null)} />;

  const usesVerbs = mode === "conjugation" || mode === "blanks";
  const todayReady = today.status === "ready" && today.reviews.length + today.fresh.length > 0;
  const vocabReady = kinds.length > 0 && wordTypes.length > 0;
  const ready =
    mode === "review" ? todayReady : mode === "flashcards" ? flashTypes.length > 0 : mode === "grammar" || (usesVerbs ? tenses.length > 0 : vocabReady);
  const showTopics = (mode === "vocabulary" && wordTypes.includes("noun")) || (mode === "flashcards" && flashTypes.includes("noun"));

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-xl font-semibold">What to practice</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m) => (
            <OptionCard key={m.id} name="mode" title={m.title} hint={m.hint} checked={mode === m.id} onChange={() => update({ mode: m.id })} />
          ))}
        </div>
      </section>

      {mode === "review" && (
        <section>
          <TodaySummary today={today} />
        </section>
      )}

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
        </>
      )}

      {mode === "flashcards" && (
        <>
          <section>
            <h2 className="mb-1 text-xl font-semibold">Which way?</h2>
            <p className="mb-3 text-sm text-zinc-500">Each session is {FLASHCARD_SESSION} cards, and they count toward your review schedule.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {FLASH_SIDES.map((s) => (
                <OptionCard key={s.id} name="flashSide" title={s.title} hint={s.hint} checked={flashSide === s.id} onChange={() => update({ flashSide: s.id })} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">Which words?</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {FLASH_TYPES.map((t) => (
                <OptionCard
                  key={t.id}
                  name={`flash-${t.id}`}
                  type="checkbox"
                  title={t.title}
                  hint={t.hint}
                  checked={flashTypes.includes(t.id)}
                  onChange={() => update({ flashTypes: toggled(flashTypes, t.id) })}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {showTopics && (
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

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => start()}
        disabled={!ready || loading}
        className="h-12 rounded-xl bg-emerald-700 px-6 font-medium text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Loading…" : "Start drilling"}
      </button>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import DrillRunner from "@/components/DrillRunner";
import { TENSES, type Mood, type TenseId } from "@/lib/conjugation/types";
import { LevelPicker, LevelPrompt } from "@/components/LevelPicker";
import { COMMON_COUNT, CORE_TENSES, conjugationCard, limitedDeck, makeQuestion, poolVerbs, type Card, type VerbPool } from "@/lib/drill";
import { levelInfo, useLevel } from "@/lib/level";
import StudyRunner from "@/components/StudyRunner";
import type { StudyCard } from "@/lib/card-decks";
import {
  NOUN_TOPICS,
  useDrillSettings,
  type CardType,
  type FlashSide,
  type Mode,
  type StudySide,
  type VocabKind,
  type WordType,
} from "@/lib/drill-settings";
import { parsePractice, type PracticeTarget } from "@/lib/practice";
import { progressEnabled } from "@/lib/progress-queue";
import { shuffled } from "@/lib/quiz";
import { itemVerbs, loadSentences } from "@/lib/sentence-loader";
import { sentencesFor } from "@/lib/sentences";
import { canSpeak, subscribeToVoices } from "@/lib/speech";
import { VERBS, findVerb, type Verb } from "@/lib/verbs";

const PRACTICE_SIZE = 15;
const FLASHCARD_SESSION = 20;
const WRITING_SESSION = 10;
const DICTATION_SESSION = 10;

const noVoiceOnServer = () => false;

const MODES: { id: Mode; title: string; hint: string }[] = [
  { id: "review", title: "Today's review", hint: "What's due, plus new items" },
  { id: "conjugation", title: "Conjugation", hint: "Type the verb form" },
  { id: "blanks", title: "Fill in the blank", hint: "Complete a real sentence" },
  { id: "vocabulary", title: "Vocabulary", hint: "Words, gender and agreement" },
  { id: "flashcards", title: "Flashcards", hint: "Flip and grade yourself" },
  { id: "study", title: "Learn words", hint: "Flip cards, nothing graded" },
  { id: "writing", title: "Writing", hint: "Translate whole sentences" },
  { id: "listening", title: "Dictation", hint: "Hear a sentence, type it" },
  { id: "grammar", title: "Grammar", hint: "Quizzes from the guides" },
];

const MOODS: { id: Mood; title: string }[] = [
  { id: "indicative", title: "Indicative" },
  { id: "subjunctive", title: "Subjunctive" },
  { id: "imperative", title: "Imperative" },
];

const pools = (common: number): { id: VerbPool; title: string; hint: string }[] => [
  { id: "common", title: "Most common", hint: `The top ${common} verbs` },
  { id: "irregular", title: "Irregular", hint: "Irregular and stem-changing" },
  { id: "all", title: "All verbs", hint: `All ${VERBS.length} verbs` },
];

function WordLevelNote({ phrases = false }: { phrases?: boolean }) {
  const level = useLevel();
  return (
    <p className="mb-3 text-sm text-stone-500">
      {level
        ? `Words up to ${levelInfo(level).name} (${level})${phrases ? ", and every phrase" : ""}. Change your level above for more.`
        : "Every word. Choose a level to start with the most useful ones."}
    </p>
  );
}

/** The current level, with a way to change it. Before one is chosen, the prompt above the page asks. */
function LevelSection() {
  const level = useLevel();
  const [changing, setChanging] = useState(false);
  if (!level) return null;
  return (
    <section>
      <p className="flex flex-wrap items-center gap-x-3">
        <span>
          <span className="text-stone-500">Your level: </span>
          <span className="font-medium">
            {levelInfo(level).name} ({level})
          </span>
        </span>
        <button
          type="button"
          aria-expanded={changing}
          onClick={() => setChanging(!changing)}
          className="min-h-10 text-sm text-accent-700 underline dark:text-accent-400"
        >
          {changing ? "Keep it" : "Change"}
        </button>
      </p>
      {changing && (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-stone-500">This also resets the verbs and tenses below to match.</p>
          <LevelPicker onChosen={() => setChanging(false)} />
        </div>
      )}
    </section>
  );
}

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

const STUDY_SIDES: { id: StudySide; title: string; hint: string }[] = [
  { id: "mixed", title: "Mixed", hint: "Some cards start in Spanish, some in English" },
  { id: "toEnglish", title: "Spanish first", hint: "Flip for the meaning" },
  { id: "toSpanish", title: "English first", hint: "Flip for the Spanish" },
];

const WRITING_SIDES: { id: FlashSide; title: string; hint: string }[] = [
  { id: "toEnglish", title: "Spanish to English", hint: "Read the Spanish, write the English" },
  { id: "toSpanish", title: "English to Spanish", hint: "Read the English, write the Spanish" },
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
        checked ? "border-accent-600 bg-accent-50 dark:bg-accent-950" : "border-stone-200 dark:border-stone-800"
      }`}
    >
      <input type={type} name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span className="block font-medium">{title}</span>
      <span className="block text-sm text-stone-500">{hint}</span>
    </label>
  );
}

const toggled = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

type Today = { status: "loading" } | { status: "signedOut" } | { status: "failed" } | { status: "ready"; reviews: string[]; fresh: string[] };

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Firebase stays out of this page's bundle, so it only loads for signed-in people who open this mode. */
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
  if (today.status === "loading") return <p className="text-stone-500">Loading…</p>;
  if (today.status === "failed") return <p role="alert">Couldn&apos;t load today&apos;s review. Check your connection and try again.</p>;
  if (today.status === "signedOut") {
    return (
      <p className="text-stone-600 dark:text-stone-400">
        Today&apos;s review needs saved progress.{" "}
        <Link href="/account" prefetch={false} className="text-accent-700 underline dark:text-accent-400">
          Sign in
        </Link>{" "}
        to use it.
      </p>
    );
  }
  if (today.reviews.length + today.fresh.length === 0) {
    return <p className="text-stone-600 dark:text-stone-400">All done for today. New reviews will be ready tomorrow.</p>;
  }
  return (
    <p className="text-stone-600 dark:text-stone-400">
      {plural(today.reviews.length, "review")} and {plural(today.fresh.length, "new item")} today.
    </p>
  );
}

export default function Drill({ rare, guideList }: { rare: string[]; guideList: { slug: string; title: string }[] }) {
  const rareSet = useMemo(() => new Set(rare), [rare]);

  const [settings, update] = useDrillSettings();
  const { mode, pool, tenses, kinds, wordTypes, topics, guides, flashSide, flashTypes, writingSides, studySide } = settings;
  const [session, setSession] = useState<{ first: Card; next: () => Card | null } | null>(null);
  const [study, setStudy] = useState<StudyCard[] | null>(null);
  const hasVoice = useSyncExternalStore(subscribeToVoices, canSpeak, noVoiceOnServer);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [today, setToday] = useState<Today>({ status: "loading" });
  const level = useLevel();
  const commonVerbs = level ? levelInfo(level).commonVerbs : COMMON_COUNT;

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
    if ("items" in target) {
      const [{ reviewDeck }, bank] = await Promise.all([import("@/lib/card-decks"), loadSentences(itemVerbs(target.items))]);
      return reviewDeck(target.items, bank, rareSet);
    }
    if ("kind" in target) {
      const { vocabDeck } = await import("@/lib/card-decks");
      return vocabDeck({ kinds: [target.kind], wordTypes: ["noun", "adjective", "adverb", "small"], topics: [], level });
    }
    if ("verb" in target) {
      const verb = findVerb(target.verb);
      return conjugationDeck(verb ? [verb] : [], CORE_TENSES);
    }
    return conjugationDeck(poolVerbs(VERBS, pool, commonVerbs), target.tenses);
  }

  async function buildDeck(): Promise<() => Card | null> {
    if (mode === "review") {
      const plan = await loadTodayPlan(rareSet);
      if (plan.status !== "ready") return () => null;
      const items = [...shuffled(plan.reviews), ...plan.fresh];
      const [{ reviewDeck }, bank] = await Promise.all([import("@/lib/card-decks"), loadSentences(itemVerbs(items))]);
      return reviewDeck(items, bank, rareSet);
    }
    const verbs = poolVerbs(VERBS, pool, commonVerbs);
    if (mode === "conjugation") return conjugationDeck(verbs, tenses);
    if (mode === "grammar") {
      const [{ quizDeck }, { GUIDE_QUIZZES }] = await Promise.all([import("@/lib/quiz"), import("@/lib/quiz-data")]);
      const chosen = guides.length ? guideList.filter((g) => guides.includes(g.slug)) : guideList;
      return quizDeck(GUIDE_QUIZZES, chosen);
    }
    const decks = await import("@/lib/card-decks");
    if (mode === "vocabulary") return decks.vocabDeck({ kinds, wordTypes, topics, level });
    if (mode === "flashcards") return limitedDeck(decks.flashcardDeck({ side: flashSide, types: flashTypes, topics, level }), FLASHCARD_SESSION);
    if (mode === "writing") return limitedDeck(decks.writingDeck(await loadSentences(verbs), verbs, tenses, writingSides), WRITING_SESSION);
    if (mode === "listening") return limitedDeck(decks.dictationDeck(await loadSentences(verbs), verbs, tenses), DICTATION_SESSION);
    return decks.blankDeck(await loadSentences(verbs), verbs, tenses);
  }

  async function start(target?: PracticeTarget) {
    setError("");
    setLoading(true);
    try {
      if (mode === "study" && !target) {
        const { studyCards } = await import("@/lib/card-decks");
        const cards = studyCards({ side: studySide, types: flashTypes, topics, level });
        if (cards.length > 0) setStudy(cards);
        else setError("No words match that choice. Try selecting more options.");
        return;
      }
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
  if (study) return <StudyRunner cards={study} onStop={() => setStudy(null)} />;

  const usesVerbs = mode === "conjugation" || mode === "blanks" || mode === "writing" || mode === "listening";
  const usesCards = mode === "flashcards" || mode === "study";
  const todayReady = today.status === "ready" && today.reviews.length + today.fresh.length > 0;
  const vocabReady = kinds.length > 0 && wordTypes.length > 0;
  const verbsReady = tenses.length > 0 && (mode !== "writing" || writingSides.length > 0) && (mode !== "listening" || hasVoice);
  const ready =
    mode === "review" ? todayReady : usesCards ? flashTypes.length > 0 : mode === "grammar" || (usesVerbs ? verbsReady : vocabReady);
  const showTopics = (mode === "vocabulary" && wordTypes.includes("noun")) || (usesCards && flashTypes.includes("noun"));

  return (
    <div className="space-y-8">
      <LevelPrompt everyone />
      <LevelSection />

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
          <p className="mb-3 text-sm text-stone-500">Pick any, or leave them all off for every guide.</p>
          <div className="flex flex-wrap gap-2">
            {guideList.map((g) => (
              <button
                key={g.slug}
                type="button"
                aria-pressed={guides.includes(g.slug)}
                onClick={() => update({ guides: toggled(guides, g.slug) })}
                className={`min-h-10 rounded-full border px-3 py-1 text-sm transition ${
                  guides.includes(g.slug)
                    ? "border-accent-700 bg-accent-700 text-white"
                    : "border-stone-200 hover:border-accent-600 dark:border-stone-700"
                }`}
              >
                {g.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {mode === "writing" && (
        <section>
          <h2 className="mb-1 text-xl font-semibold">Which way?</h2>
          <p className="mb-3 text-sm text-stone-500">
            Each session is {WRITING_SESSION} sentences. If yours doesn&apos;t match the model answer, you decide whether it counts. These add to your
            totals but not to your review schedule.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {WRITING_SIDES.map((s) => (
              <OptionCard
                key={s.id}
                name={`writing-${s.id}`}
                type="checkbox"
                title={s.title}
                hint={s.hint}
                checked={writingSides.includes(s.id)}
                onChange={() => update({ writingSides: toggled(writingSides, s.id) })}
              />
            ))}
          </div>
        </section>
      )}

      {usesVerbs && (
        <>
          <section>
            <h2 className="mb-3 text-xl font-semibold">Which verbs?</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {pools(commonVerbs).map((p) => (
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
                          className="size-4 accent-accent-700"
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
            <h2 className="mb-1 text-xl font-semibold">Which words?</h2>
            <WordLevelNote />
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

      {mode === "listening" && (
        <section>
          <h2 className="mb-1 text-xl font-semibold">How it works</h2>
          <p className="text-sm text-stone-500">
            Each session is {DICTATION_SESSION} sentences from the verbs and tenses below. Listen, then type the sentence in Spanish. Punctuation and capitals
            don&apos;t matter, accents do. These add to your totals but not to your review schedule.
          </p>
          {!hasVoice && (
            <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
              This device doesn&apos;t seem to have a Spanish voice, so dictation can&apos;t play. Voices sometimes take a moment to load. If this stays,
              add a Spanish voice in your device&apos;s speech settings.
            </p>
          )}
        </section>
      )}

      {mode === "flashcards" && (
        <section>
          <h2 className="mb-1 text-xl font-semibold">Which way?</h2>
          <p className="mb-3 text-sm text-stone-500">Each session is {FLASHCARD_SESSION} cards, and they count toward your review schedule.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {FLASH_SIDES.map((s) => (
              <OptionCard key={s.id} name="flashSide" title={s.title} hint={s.hint} checked={flashSide === s.id} onChange={() => update({ flashSide: s.id })} />
            ))}
          </div>
        </section>
      )}

      {mode === "study" && (
        <section>
          <h2 className="mb-1 text-xl font-semibold">Which side first?</h2>
          <p className="mb-3 text-sm text-stone-500">
            Flip each card to see the other side. Nothing is graded or saved, so go at your own pace.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {STUDY_SIDES.map((s) => (
              <OptionCard key={s.id} name="studySide" title={s.title} hint={s.hint} checked={studySide === s.id} onChange={() => update({ studySide: s.id })} />
            ))}
          </div>
        </section>
      )}

      {usesCards && (
        <>
          <section>
            <h2 className="mb-1 text-xl font-semibold">Which words?</h2>
            <WordLevelNote phrases />
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
          <p className="mb-3 text-sm text-stone-500">Pick any, or leave them all off for every topic.</p>
          <div className="flex flex-wrap gap-2">
            {NOUN_TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={topics.includes(t)}
                onClick={() => update({ topics: toggled(topics, t) })}
                className={`min-h-10 rounded-full border px-3 py-1 text-sm capitalize transition ${
                  topics.includes(t)
                    ? "border-accent-700 bg-accent-700 text-white"
                    : "border-stone-200 hover:border-accent-600 dark:border-stone-700"
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
        className="h-12 rounded-xl bg-accent-700 px-6 font-medium text-white transition hover:bg-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Loading…" : mode === "study" ? "Start learning" : "Start drilling"}
      </button>
    </div>
  );
}

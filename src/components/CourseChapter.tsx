"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Example, TenseCard, moodHue } from "@/components/ConjugationView";
import DrillRunner from "@/components/DrillRunner";
import GuideSections from "@/components/GuideSections";
import { LevelUpOffer } from "@/components/LevelPicker";
import { conjugate } from "@/lib/conjugation/engine";
import { markVerb } from "@/lib/conjugation/regular";
import { TENSES, type TenseId } from "@/lib/conjugation/types";
import { CHAPTERS, PASS_SCORE, STEPS, chapterSteps, nextStep, type Chapter, type StepId } from "@/lib/course";
import { completeStep, recordCheckpoint, storedCourse, syncCourse, useCourseProgress } from "@/lib/course-progress";
import type { ChapterQuiz } from "@/lib/course-decks";
import type { Card } from "@/lib/drill";
import type { GuideSection } from "@/lib/guides";
import { levelInfo } from "@/lib/level";
import { loadSentences } from "@/lib/sentence-loader";
import type { Sentence } from "@/lib/sentences";
import { findVerb, type Verb } from "@/lib/verbs";

/** A verb's sentences for one tense, main sentence first, picked on the server so the page doesn't load sentence files. */
export interface TenseSentences {
  inf: string;
  tense: TenseId;
  sentences: Sentence[];
}

const buttonClass =
  "h-11 rounded-xl bg-accent-700 px-6 font-medium text-white transition hover:bg-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:cursor-not-allowed disabled:opacity-50";
const linkClass = "text-accent-700 underline dark:text-accent-400";

const stepInfo = (id: StepId) => STEPS.find((s) => s.id === id)!;
const tenseName = (tense: TenseId) => TENSES.find((t) => t.id === tense)!.name;

function listNames(names: string[]): string {
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function Check({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
        done ? "border-accent-600 bg-accent-600 text-white" : "border-stone-300 dark:border-stone-700"
      }`}
    >
      {done ? "✓" : ""}
    </span>
  );
}

/** The tables of the chapter's model verbs, then more sentences from the bank with the form in bold. */
function SeeIt({ chapter, tables, examples }: { chapter: Chapter; tables: TenseSentences[]; examples: TenseSentences[] }) {
  return (
    <div className="space-y-8">
      {chapter.tenses.map((tense) => {
        const meta = TENSES.find((t) => t.id === tense)!;
        const shown = tables.filter((t) => t.tense === tense);
        const more = examples.filter((e) => e.tense === tense);
        return (
          <section key={tense} style={moodHue(meta.mood)} className="space-y-4">
            <h2 className="text-xl font-semibold">{meta.name}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {shown.map(({ inf, sentences }) => {
                const verb = findVerb(inf)!;
                const conjugation = conjugate(verb);
                const forms = conjugation.tenses[tense];
                return forms ? (
                  <TenseCard
                    key={inf}
                    title={`${conjugation.infinitive} · ${verb.en}`}
                    infinitive={conjugation.infinitive}
                    meta={meta}
                    forms={forms}
                    marks={markVerb(verb, conjugation)[tense]}
                    voseo={false}
                    sentence={sentences[0]}
                  />
                ) : null;
              })}
            </div>
            {more.length > 0 && (
              <div className="rounded-xl border border-stone-200 bg-white px-4 pb-3 dark:border-stone-800 dark:bg-stone-900">
                {more.map(({ inf, sentences }) => {
                  const forms = conjugate(findVerb(inf)!).tenses[tense]?.forms ?? [];
                  return sentences.map((s) => (forms[s.person] ? <Example key={`${inf}:${s.es}`} sentence={s} form={forms[s.person]!} /> : null));
                })}
              </div>
            )}
          </section>
        );
      })}
      <p className="text-sm text-stone-500">
        Endings in color follow the pattern. Highlighted forms change the stem or break the pattern.
      </p>
    </div>
  );
}

type Session = { step: StepId; first: Card; next: () => Card | null };

export default function CourseChapter({
  chapter,
  sections,
  quiz,
  tables,
  examples,
  rare,
}: {
  chapter: Chapter;
  sections: GuideSection[];
  quiz: ChapterQuiz | null;
  tables: TenseSentences[];
  examples: TenseSentences[];
  rare: string[];
}) {
  const progress = useCourseProgress();
  const mine = progress[chapter.id];
  const steps = chapterSteps(chapter);
  const upcoming = nextStep(chapter, progress);
  // By ID: the chapter arrives from the server as a copy, not the object in CHAPTERS.
  const number = CHAPTERS.findIndex((c) => c.id === chapter.id) + 1;
  const following = CHAPTERS[number];
  const lastAtLevel = CHAPTERS.filter((c) => c.level === chapter.level).at(-1)?.id === chapter.id;
  const verbs = useMemo(() => chapter.verbs.map(findVerb).filter((v): v is Verb => !!v), [chapter]);
  const rareSet = useMemo(() => new Set(rare), [rare]);

  const [open, setOpen] = useState<StepId | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [finishedStep, setFinishedStep] = useState<{ step: StepId; score: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Brings in anything saved on another device, and sends anything done here while signed out.
  useEffect(() => {
    void syncCourse();
  }, []);

  function show(step: StepId | null) {
    setOpen(step);
    setError("");
    window.scrollTo({ top: 0 });
  }

  /** Learn and See it are done by reading them. */
  function finishReading(step: "learn" | "see") {
    completeStep(chapter.id, step);
    show(nextStep(chapter, storedCourse()));
  }

  async function start(step: StepId) {
    setError("");
    setLoading(true);
    try {
      const decks = await import("@/lib/course-decks");
      const needsSentences = step === "practice" || step === "write" || step === "checkpoint";
      const bank = needsSentences ? await loadSentences(verbs) : {};
      const data = { chapter, verbs, bank, rare: rareSet, quiz };
      const next =
        step === "words"
          ? decks.wordsDeck(chapter)
          : step === "quiz" && quiz
            ? decks.chapterQuizDeck(quiz)
            : step === "practice"
              ? decks.practiceDeck(data)
              : step === "write"
                ? decks.writeDeck(data)
                : decks.checkpointDeck(data);
      const first = next();
      if (first) {
        setFinishedStep(null);
        setSession({ step, first, next });
      } else setError("Couldn't find questions for this step.");
    } catch {
      setError("Couldn't load this step. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function finish(step: StepId, score: number) {
    if (step === "checkpoint") recordCheckpoint(chapter.id, score);
    else if (step !== "learn" && step !== "see") completeStep(chapter.id, step);
    setFinishedStep({ step, score });
  }

  /** After a finished session, on to the next step. A failed checkpoint, or leaving early, stays on the step. */
  function stop() {
    const done = finishedStep?.step === session?.step;
    const step = session?.step ?? null;
    setSession(null);
    if (done && !(step === "checkpoint" && finishedStep!.score < PASS_SCORE)) show(nextStep(chapter, storedCourse()));
    else window.scrollTo({ top: 0 });
  }

  if (session) {
    return (
      <DrillRunner
        first={session.first}
        next={session.next}
        onStop={stop}
        onFinish={(score) => finish(session.step, score)}
        retry={session.step !== "checkpoint"}
        stopLabel="Back to the chapter"
      />
    );
  }

  const header = (
    <header className="space-y-2">
      {/* Only outside a session: a stray tap here would end a quiz. */}
      <Link href="/course" className="text-sm text-accent-700 underline dark:text-accent-400">
        All chapters
      </Link>
      <p className="text-sm text-stone-500">
        Chapter {number}
        {chapter.lesson && " · Short lesson"} · {levelInfo(chapter.level).name} ({chapter.level})
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{chapter.title}</h1>
      <p className="text-lg text-stone-600 dark:text-stone-400">{chapter.summary}</p>
    </header>
  );

  if (open) {
    const position = steps.indexOf(open) + 1;
    const info = stepInfo(open);
    const tenses = listNames(chapter.tenses.map(tenseName).map((n) => n.toLowerCase()));
    const failed = open === "checkpoint" && finishedStep?.step === "checkpoint" && finishedStep.score < PASS_SCORE;
    return (
      <div className="space-y-6">
        <button type="button" onClick={() => show(null)} className={`min-h-10 text-sm ${linkClass}`}>
          ← Chapter {number}: all steps
        </button>
        <header className="space-y-1">
          <p className="text-sm text-stone-500">
            Step {position} of {steps.length}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{info.title}</h1>
          <p className="text-stone-600 dark:text-stone-400">{chapter.title}</p>
        </header>

        {open === "learn" && (
          <article className="space-y-8">
            <GuideSections sections={sections} />
            <button type="button" onClick={() => finishReading("learn")} className={buttonClass}>
              Done, next step
            </button>
          </article>
        )}

        {open === "see" && (
          <div className="space-y-6">
            <SeeIt chapter={chapter} tables={tables} examples={examples} />
            <button type="button" onClick={() => finishReading("see")} className={buttonClass}>
              Done, next step
            </button>
          </div>
        )}

        {open !== "learn" && open !== "see" && (
          <section className="space-y-4">
            <p className="text-stone-600 dark:text-stone-400">
              {open === "words" &&
                `${chapter.words.length} ${chapter.words.every((w) => w.startsWith("phrase:")) ? "expressions" : "words"} that go with this chapter. Flip each card and say whether you knew it. When you're signed in, they join your review schedule and come back in Today's review.`}
              {open === "quiz" && `${quiz?.questions.length ?? 0} questions on the lesson. Each answer comes with a short explanation, and anything you miss comes back.`}
              {open === "practice" &&
                (chapter.tenses.length === 0
                  ? "15 questions on this chapter's words: el or la for each noun, and the right form of each adjective. Anything you miss comes back."
                  : chapter.drills.includes("choose")
                    ? `15 sentences with the tense hidden. Decide from the sentence whether it needs the ${tenses.replace(" and ", " or ")}, then type the form. Anything you miss comes back.`
                    : `15 questions on the ${tenses}, ${chapter.drills.length > 1 ? "mixing conjugation and fill in the blank" : chapter.drills[0] === "blanks" ? "filling in the blank in real sentences" : "typing the verb form"}. Anything you miss comes back.`)}
              {open === "write" &&
                `Translate 6 sentences in the ${tenses}, both ways. If yours doesn't match the model answer, you decide whether it counts.`}
              {open === "checkpoint" &&
                `A short test mixing ${chapter.drills.length > 0 ? "practice questions, " : ""}questions on the lesson and this chapter's words. Missed questions don't come back. ${PASS_SCORE}% or more finishes the chapter, and you can take it again any time.`}
            </p>
            {open === "checkpoint" && mine?.best !== undefined && (
              <p>
                Your best so far: <span className="font-semibold">{mine.best}%</span>
                {mine.done && " · Chapter done"}
              </p>
            )}
            {failed && (
              <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                {finishedStep?.score}% this time. Go back over the steps that felt hard, then try again.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <button type="button" onClick={() => start(open)} disabled={loading} className={buttonClass}>
              {loading ? "Loading…" : open === "checkpoint" ? (mine?.tries?.length ? "Take it again" : "Start the checkpoint") : "Start"}
            </button>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {header}

      {mine?.done ? (
        <section className="space-y-3 rounded-xl border border-t-4 border-stone-200 border-t-accent-500 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
          <p className="text-lg font-semibold">¡Capítulo terminado! Best checkpoint: {mine.best}%</p>
          {lastAtLevel && <LevelUpOffer to={chapter.level} />}
          {following ? (
            <Link href={`/course/${following.id}`} className={`inline-flex items-center ${buttonClass}`}>
              Next: {following.title}
            </Link>
          ) : (
            <p>That was the last chapter. Keep it fresh with Today&apos;s review.</p>
          )}
        </section>
      ) : (
        upcoming && (
          <button type="button" onClick={() => show(upcoming)} className={buttonClass}>
            {(mine?.steps.length ?? 0) > 0 ? "Continue" : "Start"}: {stepInfo(upcoming).title}
          </button>
        )
      )}

      <ol className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
        {steps.map((id, i) => {
          const done = mine?.steps.includes(id) ?? false;
          const info = stepInfo(id);
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => show(id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent-50 dark:hover:bg-accent-950 ${
                  id === upcoming ? "bg-accent-50 dark:bg-accent-950" : ""
                }`}
              >
                <Check done={done} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {i + 1}. {info.title}
                  </span>
                  <span className="block text-sm text-stone-500">
                    {id === "checkpoint" && mine?.best !== undefined ? `Best: ${mine.best}%` : info.hint}
                  </span>
                </span>
                {id === upcoming && <span className="text-sm font-medium text-accent-700 dark:text-accent-300">Next</span>}
              </button>
            </li>
          );
        })}
      </ol>

      <p className="text-sm text-stone-500">
        Every step stays open, so skip what you already know. When you&apos;re signed in, answers here count toward your progress
        and review schedule like any drill.{" "}
        <Link href="/course" className={linkClass}>
          All chapters
        </Link>
      </p>
    </div>
  );
}

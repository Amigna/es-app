"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BadgeArt from "@/components/Badge";
import DrillRunner from "@/components/DrillRunner";
import { LevelUpOffer } from "@/components/LevelPicker";
import { findBadge } from "@/lib/badges";
import { CHAPTERS, EXAM_LEVELS, EXAM_PASS_SCORE, EXAM_REVIEW, EXAM_SIZE, examId, isDone, levelChapters } from "@/lib/course";
import { recordCheckpoint, syncCourse, useCourseProgress } from "@/lib/course-progress";
import type { ChapterQuiz } from "@/lib/course-decks";
import type { Card } from "@/lib/drill";
import { levelInfo, type Level } from "@/lib/level";

const buttonClass =
  "h-11 rounded-xl bg-accent-700 px-6 font-medium text-white transition hover:bg-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:cursor-not-allowed disabled:opacity-50";
const linkClass = "text-accent-700 underline dark:text-accent-400";

type Session = { first: Card; next: () => Card | null };

/** A level's exam: questions from every chapter quiz at the level. Passing earns the level's badge. */
export default function CourseExam({ level, quizzes, review }: { level: Level; quizzes: ChapterQuiz[]; review: ChapterQuiz[] }) {
  const progress = useCourseProgress();
  const id = examId(level);
  const mine = progress[id];
  const info = levelInfo(level);
  const chapters = levelChapters(level);
  const chaptersLeft = chapters.filter((c) => !isDone(progress, c.id)).length;
  const nextLevel = EXAM_LEVELS[EXAM_LEVELS.indexOf(level) + 1];
  const nextChapter = nextLevel && levelChapters(nextLevel)[0];

  const [session, setSession] = useState<Session | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void syncCourse();
  }, []);

  async function start() {
    setError("");
    setLoading(true);
    try {
      const [{ examDeck }, { quizSeen, remembering }] = await Promise.all([import("@/lib/course-decks"), import("@/lib/quiz-seen")]);
      const next = remembering(examDeck(quizzes, review, reviewCount, quizSeen()));
      const first = next();
      if (first) {
        setScore(null);
        setSession({ first, next });
      } else setError("Couldn't find questions for this exam.");
    } catch {
      setError("Couldn't load the exam. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function finish(result: number) {
    recordCheckpoint(id, result, EXAM_PASS_SCORE);
    setScore(result);
  }

  if (session) {
    return (
      <DrillRunner
        first={session.first}
        next={session.next}
        onStop={() => {
          setSession(null);
          window.scrollTo({ top: 0 });
        }}
        onFinish={finish}
        retry={false}
        stopLabel="Back to the exam"
      />
    );
  }

  const reviewCount = review.length ? (EXAM_REVIEW[level] ?? 0) : 0;
  const pool = new Set(quizzes.flatMap((q) => q.questions.map((x) => `${q.slug}:${x.index}`))).size;
  const count = Math.min(EXAM_SIZE - reviewCount, pool);
  const failed = score !== null && score < EXAM_PASS_SCORE;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href="/course" className="text-sm text-accent-700 underline dark:text-accent-400">
          All chapters
        </Link>
        <p className="text-sm text-stone-500">
          Section exam · {info.name} ({level})
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{level} exam</h1>
        <p className="text-lg text-stone-600 dark:text-stone-400">
          {count} questions from the quizzes of chapters {CHAPTERS.indexOf(chapters[0]) + 1} to {CHAPTERS.indexOf(chapters.at(-1)!) + 1}, a few from
          each{reviewCount > 0 && `, plus ${reviewCount} review questions from earlier levels`}. Missed questions don&apos;t come back. {EXAM_PASS_SCORE}% or more earns the {level} badge, and you can take it again any time.
        </p>
      </header>

      {mine?.done ? (
        <section className="space-y-3 rounded-xl border border-t-4 border-stone-200 border-t-accent-500 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
          <div className="flex items-center gap-4">
            <BadgeArt badge={findBadge(`level:${level}`)!} size={64} />
            <p className="text-lg font-semibold">
              ¡Examen aprobado! Best: {mine.best}%
              <span className="block text-base font-normal">The {level} badge is yours.</span>
            </p>
          </div>
          <LevelUpOffer to={level} />
          {nextChapter ? (
            <Link href={`/course/${nextChapter.id}`} className={`inline-flex items-center ${buttonClass.replace("h-11", "min-h-11 py-2")}`}>
              On to {nextLevel}: {nextChapter.title}
            </Link>
          ) : (
            <p>That was the last exam. Keep it fresh with Today&apos;s review.</p>
          )}
        </section>
      ) : (
        chaptersLeft > 0 && (
          <p className="text-stone-600 dark:text-stone-400">
            {chaptersLeft === chapters.length ? "You haven't finished any" : `You have ${chaptersLeft} more`} {level} chapter{chaptersLeft === 1 ? "" : "s"}{" "}
            {chaptersLeft === chapters.length ? "yet" : "to finish"}. The exam is open anyway, so take it whenever you feel ready.
          </p>
        )
      )}

      <section className="space-y-4">
        {mine?.best !== undefined && !mine.done && (
          <p>
            Your best so far: <span className="font-semibold">{mine.best}%</span>
          </p>
        )}
        {failed && (
          <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            {score}% this time. Go back over the chapters that felt hard, then try again.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button type="button" onClick={start} disabled={loading} className={buttonClass}>
          {loading ? "Loading…" : mine?.tries?.length ? "Take it again" : "Start the exam"}
        </button>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">What it covers</h2>
        <ol className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
          {chapters.map((c) => (
            <li key={c.id}>
              <Link href={`/course/${c.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-accent-50 dark:hover:bg-accent-950">
                {isDone(progress, c.id) ? (
                  <BadgeArt badge={findBadge(`chapter:${c.id}`)!} size={32} />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-stone-300 text-sm font-semibold tabular-nums text-stone-600 dark:border-stone-700 dark:text-stone-400"
                  >
                    {CHAPTERS.indexOf(c) + 1}
                  </span>
                )}
                <span className="font-medium">{c.title}</span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-stone-500">
          <Link href="/course" className={linkClass}>
            All chapters
          </Link>
        </p>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BadgeArt from "@/components/Badge";
import DrillRunner from "@/components/DrillRunner";
import { findBadge, type Badge } from "@/lib/badges";
import { CHAPTERS, PASS_SCORE, REVIEW_SIZE, findChapter, findReview, isDone, recentChapters, reviewChapters, reviewTitle } from "@/lib/course";
import { recordCheckpointBadges, syncCourse, useCourseProgress } from "@/lib/course-progress";
import type { ChapterData, ChapterQuiz } from "@/lib/course-decks";
import type { Card } from "@/lib/drill";
import { levelInfo } from "@/lib/level";
import { loadSentences } from "@/lib/sentence-loader";
import { withExtraSentences, type SentenceBank } from "@/lib/sentences";
import { findVerb, type Verb } from "@/lib/verbs";

/** What one covered chapter sends to the browser for its share of the review. */
export interface ReviewPart {
  id: string;
  quiz: ChapterQuiz | null;
  extra: SentenceBank;
  rare: string[];
}

const buttonClass =
  "h-11 rounded-xl bg-accent-700 px-6 font-medium text-white transition hover:bg-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:cursor-not-allowed disabled:opacity-50";
const linkClass = "text-accent-700 underline dark:text-accent-400";

type Session = { first: Card; next: () => Card | null };

const number = (id: string) => CHAPTERS.findIndex((c) => c.id === id) + 1;

/** A review checkpoint: everything up to this point in the course, mostly the chapters since the last review. */
export default function CourseReview({ slug, parts }: { slug: string; parts: ReviewPart[] }) {
  const review = findReview(slug)!;
  const progress = useCourseProgress();
  const mine = progress[review.id];
  const covered = reviewChapters(review);
  const recent = recentChapters(review);
  const following = CHAPTERS[number(review.after)];

  const [session, setSession] = useState<Session | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [earned, setEarned] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void syncCourse();
  }, []);

  async function start() {
    setError("");
    setLoading(true);
    try {
      const [{ reviewDeck }, { quizSeen, remembering }] = await Promise.all([import("@/lib/course-decks"), import("@/lib/quiz-seen")]);
      const allVerbs = [...new Set(covered.flatMap((c) => c.verbs))].map(findVerb).filter((v): v is Verb => !!v);
      const bank = await loadSentences(allVerbs);
      const seen = quizSeen();
      const data: ChapterData[] = parts.map((part) => {
        const chapter = findChapter(part.id)!;
        return {
          chapter,
          verbs: chapter.verbs.map(findVerb).filter((v): v is Verb => !!v),
          bank: withExtraSentences(bank, part.extra),
          rare: new Set(part.rare),
          quiz: part.quiz,
          seen,
        };
      });
      const next = remembering(reviewDeck(data, new Set(recent.map((c) => c.id))));
      const first = next();
      if (first) {
        setScore(null);
        setEarned([]);
        setSession({ first, next });
      } else setError("Couldn't find questions for this review.");
    } catch {
      setError("Couldn't load the review. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function finish(result: number) {
    setEarned(recordCheckpointBadges(review.id, result));
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
        badges={earned}
        retry={false}
        stopLabel="Back to the review"
      />
    );
  }

  const failed = score !== null && score < PASS_SCORE;
  const earlier = covered.length - recent.length;
  const notDone = covered.filter((c) => !isDone(progress, c.id)).length;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href="/course" className="text-sm text-accent-700 underline dark:text-accent-400">
          All chapters
        </Link>
        <p className="text-sm text-stone-500">
          Review checkpoint · {levelInfo(review.level).name} ({review.level})
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{reviewTitle(review)}</h1>
        <p className="text-lg text-stone-600 dark:text-stone-400">
          {REVIEW_SIZE} questions on everything so far:{" "}
          {earlier > 0
            ? `most from chapters ${number(recent[0].id)} to ${number(review.after)}, and the rest from chapters 1 to ${number(recent[0].id) - 1}`
            : `chapters 1 to ${number(review.after)}`}
          . Verb forms, quiz questions, words and sentences to translate, with sentences the chapters held back. Missed questions don&apos;t come back. {PASS_SCORE}% or more passes, and you can take it again any time.
        </p>
      </header>

      {mine?.done ? (
        <section className="space-y-3 rounded-xl border border-t-4 border-stone-200 border-t-accent-500 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
          <p className="text-lg font-semibold">
            ¡Repaso aprobado! Best: {mine.best}%
            <span className="block text-base font-normal">Everything up to here is holding up.</span>
          </p>
          {following && (
            <Link href={`/course/${following.id}`} className={`inline-flex items-center ${buttonClass.replace("h-11", "min-h-11 py-2")}`}>
              Next: {following.title}
            </Link>
          )}
        </section>
      ) : (
        notDone > 0 && (
          <p className="text-stone-600 dark:text-stone-400">
            {notDone} of the {covered.length} chapters it covers {notDone === 1 ? "isn't" : "aren't"} done yet. The review is open anyway, so take it whenever you feel ready.
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
          {loading ? "Loading…" : mine?.tries?.length ? "Take it again" : "Start the review"}
        </button>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">What it covers</h2>
        <ol className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
          {covered.map((c) => (
            <li key={c.id}>
              <Link href={`/course/${c.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-accent-50 dark:hover:bg-accent-950">
                {isDone(progress, c.id) ? (
                  <BadgeArt badge={findBadge(`chapter:${c.id}`)!} size={32} />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-stone-300 text-sm font-semibold tabular-nums text-stone-600 dark:border-stone-700 dark:text-stone-400"
                  >
                    {number(c.id)}
                  </span>
                )}
                <span className="min-w-0 flex-1 font-medium">{c.title}</span>
                {recent.includes(c) && <span className="text-sm text-stone-500">Most questions</span>}
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

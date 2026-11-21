"use client";

import Link from "next/link";
import BadgeArt from "@/components/Badge";
import { earnedBadges, findBadge } from "@/lib/badges";
import { useEffect, useState } from "react";
import { CHAPTERS, EXAM_PASS_SCORE, STEPS, chapterSteps, chaptersDone, examId, isDone, levelComplete, stepsLeft, suggestedChapter, type ChapterProgress, type CourseProgress } from "@/lib/course";
import { syncCourse, useCourseProgress } from "@/lib/course-progress";
import { LEVELS, levelInfo, useLevel, type Level } from "@/lib/level";

function status(chapter: (typeof CHAPTERS)[number], progress: CourseProgress): string {
  const mine = progress[chapter.id];
  const kind = chapter.lesson ? "Short lesson · " : "";
  if (mine?.done) return `${kind}Done · best ${mine.best}%`;
  const total = chapterSteps(chapter).length;
  const finished = mine?.steps.length ?? 0;
  if (finished > 0) return `${kind}${finished} of ${total} steps${mine?.best !== undefined ? ` · best ${mine.best}%` : ""}`;
  return `${kind}${total} steps`;
}

/** A finished chapter with a step still to do, like Read added after it was passed. Null when there's nothing left. */
function leftNote(chapter: (typeof CHAPTERS)[number], progress: CourseProgress): string | null {
  const left = stepsLeft(chapter, progress);
  if (left.length === 0) return null;
  return left.length === 1 ? `${STEPS.find((s) => s.id === left[0])!.title} not done yet` : `${left.length} steps not done yet`;
}

function examStatus(mine: ChapterProgress | undefined, chapters: number): string {
  if (mine?.done) return `Passed · best ${mine.best}% · badge earned`;
  if (mine?.best !== undefined) return `Best ${mine.best}% · ${EXAM_PASS_SCORE}% passes`;
  return `Questions from all ${chapters} chapters · passing earns the badge`;
}

/** Every chapter by level, with progress from this browser and, once synced, the account. */
export default function CourseList() {
  const progress = useCourseProgress();
  const level = useLevel();
  const suggested = suggestedChapter(progress, level);
  const done = chaptersDone(progress);
  const earned = earnedBadges({ course: progress }, "");
  // Levels opened or closed by hand this visit; the rest follow levelComplete.
  const [toggled, setToggled] = useState<Partial<Record<Level, boolean>>>({});

  useEffect(() => {
    void syncCourse();
  }, []);

  return (
    <div className="space-y-8">
      {suggested && (
        <section className="space-y-3 rounded-xl border border-t-4 border-stone-200 border-t-accent-500 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
          <p className="text-sm text-stone-500">
            {done > 0
              ? `${done} of ${CHAPTERS.length} chapters done`
              : level
                ? `Suggested start for ${levelInfo(level).name.toLowerCase()} (${level})`
                : "Start at the beginning, or anywhere you like"}
          </p>
          <p className="text-xl font-semibold">
            Chapter {CHAPTERS.indexOf(suggested) + 1}: {suggested.title}
          </p>
          <Link
            href={`/course/${suggested.id}`}
            className="inline-flex h-11 items-center rounded-xl bg-accent-700 px-6 font-medium text-white transition hover:bg-accent-800"
          >
            {progress[suggested.id] ? "Continue" : "Start"}
          </Link>
        </section>
      )}

      {LEVELS.map((l) => {
        const chapters = CHAPTERS.filter((c) => c.level === l.id);
        if (chapters.length === 0) return null;
        const complete = levelComplete(l.id, progress);
        // A finished level starts closed; any level opens and closes with a tap.
        const open = toggled[l.id] ?? !complete;
        return (
          <details key={l.id} open={open} className="group">
            <summary
              // Kept in state rather than left to the browser, so a level still closes once progress loads.
              onClick={(e) => {
                e.preventDefault();
                setToggled((t) => ({ ...t, [l.id]: !open }));
              }}
              className="mb-3 flex cursor-pointer list-none items-center gap-2 rounded-lg [&::-webkit-details-marker]:hidden"
            >
              <h2 className="flex flex-1 flex-wrap items-center gap-x-2 text-xl font-semibold">
                <BadgeArt badge={findBadge(`level:${l.id}`)!} size={32} locked={!earned[`level:${l.id}`]} />
                <span>
                  {l.name} <span className="text-base font-normal text-stone-500">{l.id}</span>
                </span>
                {complete &&
                  (isDone(progress, examId(l.id)) ? (
                    <span className="text-sm font-normal text-emerald-700 dark:text-emerald-400">All done</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      Chapters done · exam not passed yet
                    </span>
                  ))}
              </h2>
              <svg aria-hidden viewBox="0 0 20 20" className="size-5 shrink-0 text-stone-500 transition group-open:rotate-180">
                <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <ol className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
              {chapters.map((c) => {
                const n = CHAPTERS.indexOf(c) + 1;
                const mine = progress[c.id];
                return (
                  <li key={c.id}>
                    <Link
                      href={`/course/${c.id}`}
                      className={`flex items-center gap-3 px-4 py-3 transition hover:bg-accent-50 dark:hover:bg-accent-950 ${
                        c === suggested ? "bg-accent-50 dark:bg-accent-950" : ""
                      }`}
                    >
                      {mine?.done ? (
                        <BadgeArt badge={findBadge(`chapter:${c.id}`)!} size={36} />
                      ) : (
                        <span
                          aria-hidden
                          className="mx-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-stone-300 text-sm font-semibold tabular-nums text-stone-600 dark:border-stone-700 dark:text-stone-400"
                        >
                          {n}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          <span className="sr-only">Chapter {n}: </span>
                          {c.title}
                        </span>
                        <span className="block text-sm text-stone-500">{status(c, progress)}</span>
                        {leftNote(c, progress) && (
                          <span className="mt-1 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                            {leftNote(c, progress)}
                          </span>
                        )}
                      </span>
                      {c === suggested && <span className="text-sm font-medium text-accent-700 dark:text-accent-300">Next</span>}
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link
                  href={`/course/exam/${l.id.toLowerCase()}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-accent-50 dark:hover:bg-accent-950"
                >
                  <BadgeArt badge={findBadge(`level:${l.id}`)!} size={36} locked={!earned[`level:${l.id}`]} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{l.id} exam</span>
                    <span className="block text-sm text-stone-500">{examStatus(progress[examId(l.id)], chapters.length)}</span>
                  </span>
                </Link>
              </li>
            </ol>
          </details>
        );
      })}

      <p className="text-sm text-stone-500">
        Every chapter stays open, so skip ahead or go back whenever you like. Your level only suggests where to start. Progress is
        kept in this browser, and saved to your account when you&apos;re signed in.
      </p>
    </div>
  );
}

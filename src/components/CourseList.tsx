"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CHAPTERS, chapterSteps, chaptersDone, suggestedChapter, type ChapterProgress } from "@/lib/course";
import { syncCourse, useCourseProgress } from "@/lib/course-progress";
import { LEVELS, levelInfo, useLevel } from "@/lib/level";

function status(chapter: (typeof CHAPTERS)[number], mine: ChapterProgress | undefined): string {
  const kind = chapter.lesson ? "Short lesson · " : "";
  if (mine?.done) return `${kind}Done · best ${mine.best}%`;
  const total = chapterSteps(chapter).length;
  const finished = mine?.steps.length ?? 0;
  if (finished > 0) return `${kind}${finished} of ${total} steps${mine?.best !== undefined ? ` · best ${mine.best}%` : ""}`;
  return `${kind}${total} steps`;
}

/** Every chapter by level, with progress from this browser and, once synced, the account. */
export default function CourseList() {
  const progress = useCourseProgress();
  const level = useLevel();
  const suggested = suggestedChapter(progress, level);
  const done = chaptersDone(progress);

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
        return (
          <section key={l.id}>
            <h2 className="mb-3 text-xl font-semibold">
              {l.name} <span className="text-base font-normal text-stone-500">{l.id}</span>
            </h2>
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
                      <span
                        aria-hidden
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                          mine?.done ? "bg-accent-600 text-white" : "border-2 border-stone-300 text-stone-600 dark:border-stone-700 dark:text-stone-400"
                        }`}
                      >
                        {mine?.done ? "✓" : n}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          <span className="sr-only">Chapter {n}: </span>
                          {c.title}
                        </span>
                        <span className="block text-sm text-stone-500">{status(c, mine)}</span>
                      </span>
                      {c === suggested && <span className="text-sm font-medium text-accent-700 dark:text-accent-300">Next</span>}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      <p className="text-sm text-stone-500">
        Every chapter stays open, so skip ahead or go back whenever you like. Your level only suggests where to start. Progress is
        kept in this browser, and saved to your account when you&apos;re signed in.
      </p>
    </div>
  );
}

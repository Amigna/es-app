"use client";

import Link from "next/link";
import { CHAPTERS, nextStep, STEPS, suggestedChapter } from "@/lib/course";
import { useCourseProgress } from "@/lib/course-progress";
import { useLevel } from "@/lib/level";

/** The home page's way into the course. Once a chapter is started, it goes straight back to it. */
export default function CourseShortcut({ className }: { className: string }) {
  const progress = useCourseProgress();
  const level = useLevel();
  const chapter = suggestedChapter(progress, level);
  const started = Object.keys(progress).length > 0;
  const step = chapter && nextStep(chapter, progress);
  const note =
    started && chapter
      ? `Chapter ${CHAPTERS.indexOf(chapter) + 1}: ${chapter.title}${step && progress[chapter.id] ? ` · ${STEPS.find((s) => s.id === step)!.title}` : ""}`
      : "Grammar step by step, chapter by chapter";
  return (
    <Link href={started && chapter ? `/course/${chapter.id}` : "/course"} className={className}>
      <span className="block text-lg font-semibold text-accent-800 dark:text-accent-200">{started ? "Continue the course" : "Course"} →</span>
      <span className="block text-sm text-stone-600 dark:text-stone-400">{note}</span>
    </Link>
  );
}

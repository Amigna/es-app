import type { Metadata } from "next";
import CourseList from "@/components/CourseList";

export const metadata: Metadata = { title: "Course" };

export default function CoursePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Course</h1>
        <p className="text-stone-600 dark:text-stone-400">
          A step-by-step path through Spanish grammar, one topic per chapter. Chapters bring together a short lesson, the pattern
          with real sentences, words for the theme, a quiz, practice and a little writing, and end with a checkpoint.
        </p>
      </header>
      <CourseList />
    </div>
  );
}

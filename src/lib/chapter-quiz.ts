import type { Chapter } from "./course";
import type { ChapterQuiz } from "./course-decks";
import { findGuide } from "./guides";
import { GUIDE_QUIZZES } from "./quiz-data";

// For server pages: it imports every guide quiz, so only the questions picked reach the browser.

/** The guide questions a chapter uses, each with its place in the full quiz. Null when it has none. */
export function chapterQuiz(chapter: Chapter): ChapterQuiz | null {
  const guide = chapter.guide && findGuide(chapter.guide.slug);
  if (!guide || !chapter.guide) return null;
  const all = GUIDE_QUIZZES[guide.slug] ?? [];
  const indexes = (chapter.guide.quiz ?? all.map((_, i) => i)).filter((i) => all[i]);
  return indexes.length > 0 ? { slug: guide.slug, title: guide.title, questions: indexes.map((index) => ({ index, question: all[index] })) } : null;
}

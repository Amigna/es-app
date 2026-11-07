import courseSentencesRaw from "../data/course-sentences.json";
import type { Chapter } from "./course";
import type { ChapterQuiz } from "./course-decks";
import { findGuide } from "./guides";
import { GUIDE_QUIZZES } from "./quiz-data";
import type { SentenceBank } from "./sentences";

// For server pages: it imports every guide quiz and the chapters' own sentences, so only a chapter's share reaches the
// browser.

/**
 * Sentences a chapter adds to its practice, writing and checkpoint, where the bank's one per person would repeat, like
 * ser and estar. Kept apart from the bank, which verb pages and tense tables show.
 */
const COURSE_SENTENCES = courseSentencesRaw as Record<string, SentenceBank>;
export const chapterSentences = (id: string): SentenceBank => COURSE_SENTENCES[id] ?? {};

/** The guide questions a chapter uses, each with its place in the full quiz. Null when it has none. */
export function chapterQuiz(chapter: Chapter): ChapterQuiz | null {
  const guide = chapter.guide && findGuide(chapter.guide.slug);
  if (!guide || !chapter.guide) return null;
  const all = GUIDE_QUIZZES[guide.slug] ?? [];
  const indexes = (chapter.guide.quiz ?? all.map((_, i) => i)).filter((i) => all[i]);
  return indexes.length > 0 ? { slug: guide.slug, title: guide.title, questions: indexes.map((index) => ({ index, question: all[index] })) } : null;
}

import type { Card } from "./drill";
import { quizCard, type QuizQuestion } from "./quiz";

export type ReadingLevel = "A1" | "A2" | "B1";

export interface Reading {
  slug: string;
  title: string;
  en: string;
  level: ReadingLevel;
  place: string;
  paragraphs: { es: string; en: string }[];
  words: { es: string; en: string }[];
  questions: QuizQuestion[];
}

/** What each level may use, so a passage stays readable by the people it's meant for. */
export const LEVELS: { id: ReadingLevel; name: string; grammar: string; minWords: number; maxWords: number }[] = [
  { id: "A1", name: "Beginner", grammar: "Present tense and plans with ir a", minWords: 45, maxWords: 90 },
  { id: "A2", name: "Elementary", grammar: "Adds the preterite and imperfect", minWords: 90, maxWords: 150 },
  { id: "B1", name: "Intermediate", grammar: "Adds the perfect, future, conditional and subjunctive", minWords: 140, maxWords: 230 },
];

export const wordCount = (r: Reading) => r.paragraphs.flatMap((p) => p.es.split(/\s+/)).length;

/** Splits text into words and what's between them, keeping everything, so the passage reads the same with each word tappable. */
export function tokenize(text: string): { text: string; word: boolean }[] {
  return text
    .split(/(\p{L}+)/u)
    .filter(Boolean)
    .map((part) => ({ text: part, word: /^\p{L}+$/u.test(part) }));
}

/** The questions follow the passage, so they stay in order. Not saved to progress, like the rest of this page. */
export function readingDeck(reading: Reading, random: () => number = Math.random): () => Card | null {
  const cards = reading.questions.map((q, i): Card => ({
    ...quizCard(reading.slug, i, reading.title, q, random),
    id: `reading:${reading.slug}:${i}`,
    link: undefined,
    track: undefined,
  }));
  return () => cards.shift() ?? null;
}

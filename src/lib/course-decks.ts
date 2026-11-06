import { blankDeck, listedWordCard, writingDeck } from "./card-decks";
import type { Chapter } from "./course";
import { conjugationCard, limitedDeck, makeQuestion, type Card } from "./drill";
import { quizCard, shuffled, type QuizQuestion } from "./quiz";
import { sentencesFor, type SentenceBank } from "./sentences";
import type { Verb } from "./verbs";

// The drills inside a chapter, locked to its tenses, verbs, words and guide. Imported on demand like card-decks, which
// it pulls in. Answers count toward progress and the review schedule like any drill.

type Random = () => number;

export const PRACTICE_SIZE = 15;
export const WRITE_SIZE = 6;
/** Verb, quiz and word questions in a checkpoint, before any are moved to fill a gap. */
const CHECKPOINT_MIX = { verbs: 6, quiz: 5, words: 4 };

/** The guide's questions for a chapter, each with its place in the full quiz, so saved items match the guide's own quiz. */
export interface ChapterQuiz {
  slug: string;
  title: string;
  questions: { index: number; question: QuizQuestion }[];
}

export interface ChapterData {
  chapter: Chapter;
  verbs: Verb[];
  bank: SentenceBank;
  rare: Set<string>;
  quiz: ChapterQuiz | null;
}

/** Conjugation and fill-in-the-blank in turn, as the chapter allows. Endless, so callers limit it. */
function verbDeck({ chapter, verbs, bank, rare }: ChapterData, random: Random): () => Card | null {
  const blanks = blankDeck(bank, verbs, chapter.tenses, random);
  const conjugation = () => {
    const q = makeQuestion(verbs, chapter.tenses, rare, random);
    return q && conjugationCard(q, sentencesFor(bank, q.verb.inf, q.tense));
  };
  const kinds = chapter.drills.map((d) => (d === "blanks" ? blanks : conjugation));
  let turn = Math.floor(random() * Math.max(1, kinds.length));
  return () => {
    if (kinds.length === 0) return null;
    // A verb with no sentence for the tense gives no blank, so the other kind fills in.
    for (let i = 0; i < kinds.length; i++) {
      const card = kinds[turn++ % kinds.length]();
      if (card) return card;
    }
    return null;
  };
}

/** Up to `count` cards with different IDs, so a short test doesn't ask the same thing twice. */
function distinct(next: () => Card | null, count: number): Card[] {
  const out = new Map<string, Card>();
  for (let tries = 0; out.size < count && tries < count * 5; tries++) {
    const card = next();
    if (!card) break;
    if (!out.has(card.id)) out.set(card.id, card);
  }
  return [...out.values()];
}

const queue = (cards: Card[]): (() => Card | null) => {
  const left = [...cards];
  return () => left.shift() ?? null;
};

export function practiceDeck(data: ChapterData, random: Random = Math.random): () => Card | null {
  return limitedDeck(verbDeck(data, random), PRACTICE_SIZE);
}

export function quizCards(quiz: ChapterQuiz, random: Random = Math.random): Card[] {
  return quiz.questions.map(({ index, question }) => quizCard(quiz.slug, index, quiz.title, question, random));
}

export function chapterQuizDeck(quiz: ChapterQuiz, random: Random = Math.random): () => Card | null {
  return queue(shuffled(quizCards(quiz, random), random));
}

/** Every word once, as flashcards, in random order. */
export function wordsDeck(chapter: Chapter, random: Random = Math.random): () => Card | null {
  const cards = shuffled(chapter.words, random).flatMap((id) => listedWordCard(id, "flashcard", random) ?? []);
  return queue(cards);
}

export function writeDeck({ chapter, verbs, bank }: ChapterData, random: Random = Math.random): () => Card | null {
  return limitedDeck(writingDeck(bank, verbs, chapter.tenses, ["toEnglish", "toSpanish"], random), WRITE_SIZE);
}

/**
 * A short mixed test: verb forms, guide questions and the chapter's words, typed. When a chapter has no verb drills or
 * no quiz, the other parts take its share. Missed questions don't come back, so the score is a first try.
 */
export function checkpointCards(data: ChapterData, random: Random = Math.random): Card[] {
  const { chapter, quiz } = data;
  const total = CHECKPOINT_MIX.verbs + CHECKPOINT_MIX.quiz + CHECKPOINT_MIX.words;
  const quizPool = quiz ? shuffled(quizCards(quiz, random), random) : [];
  const verbs = chapter.drills.length > 0 ? distinct(verbDeck(data, random), CHECKPOINT_MIX.verbs + (quizPool.length > 0 ? 0 : CHECKPOINT_MIX.quiz)) : [];
  const quizCount = Math.min(quizPool.length, total - CHECKPOINT_MIX.words - verbs.length);
  const words = shuffled(chapter.words, random)
    .slice(0, total - verbs.length - quizCount)
    .flatMap((id) => listedWordCard(id, "toSpanish", random) ?? []);
  return shuffled([...verbs, ...quizPool.slice(0, quizCount), ...words], random);
}

export const checkpointDeck = (data: ChapterData, random: Random = Math.random) => queue(checkpointCards(data, random));

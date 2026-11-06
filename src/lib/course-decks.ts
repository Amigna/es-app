import { blankDeck, listedWordCard, writingDeck } from "./card-decks";
import type { Chapter, ChapterDrill } from "./course";
import { TENSES } from "./conjugation/types";
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

/** A chapter word the question fits, like a noun for gender. Null when none does. */
function wordQuestion(words: string[], kind: "gender" | "agreement", random: Random): () => Card | null {
  const fitting = words.filter((id) => listedWordCard(id, kind));
  return () => (fitting.length ? listedWordCard(fitting[Math.floor(random() * fitting.length)], kind, random) : null);
}

/**
 * Fill in the blank with the tense hidden, so the sentence has to show which of the chapter's tenses it takes. After
 * answering, it says which one. The saved item is still the verb and tense, so stats by tense stay right.
 */
function chooseTenseDeck({ chapter, verbs, bank }: ChapterData, random: Random): () => Card | null {
  const blanks = blankDeck(bank, verbs, chapter.tenses, random);
  const names = chapter.tenses.map((t) => TENSES.find((m) => m.id === t)!.name);
  const label = `${names.slice(0, -1).join(", ")} or ${names.at(-1)!.toLowerCase()}?`;
  return () => {
    const card = blanks();
    const tense = card && TENSES.find((t) => t.id === card.track?.tense);
    if (!card || !tense) return card;
    return { ...card, id: `choose:${card.id}`, badge: label, context: "Which tense does the sentence need?", explain: `This sentence takes the ${tense.name.toLowerCase()}.` };
  };
}

/** The chapter's drills in turn: verb forms, or gender and agreement on its words. Endless, so callers limit it. */
function drillDeck(data: ChapterData, random: Random): () => Card | null {
  const { chapter, verbs, bank, rare } = data;
  const decks: Record<ChapterDrill, () => () => Card | null> = {
    blanks: () => blankDeck(bank, verbs, chapter.tenses, random),
    conjugation: () => () => {
      const q = makeQuestion(verbs, chapter.tenses, rare, random);
      return q && conjugationCard(q, sentencesFor(bank, q.verb.inf, q.tense));
    },
    gender: () => wordQuestion(chapter.words, "gender", random),
    agreement: () => wordQuestion(chapter.words, "agreement", random),
    choose: () => chooseTenseDeck(data, random),
  };
  const kinds = chapter.drills.map((d) => decks[d]());
  let turn = Math.floor(random() * Math.max(1, kinds.length));
  return () => {
    if (kinds.length === 0) return null;
    // A verb with no sentence for the tense gives no blank, so another kind fills in.
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
  return limitedDeck(drillDeck(data, random), PRACTICE_SIZE);
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
 * A short mixed test: the chapter's drills, guide questions and its words, typed. When a part has nothing to ask, like
 * phrases, which are never typed, the others take its share. Missed questions don't come back, so the score is a first try.
 */
export function checkpointCards(data: ChapterData, random: Random = Math.random): Card[] {
  const { chapter, quiz } = data;
  const total = CHECKPOINT_MIX.verbs + CHECKPOINT_MIX.quiz + CHECKPOINT_MIX.words;
  const quizPool = quiz ? shuffled(quizCards(quiz, random), random) : [];
  const typed = shuffled(chapter.words, random).flatMap((id) => listedWordCard(id, "toSpanish", random) ?? []);
  const words = typed.slice(0, CHECKPOINT_MIX.words);
  const drillShare = chapter.drills.length > 0 ? CHECKPOINT_MIX.verbs : 0;
  const quizCount = Math.min(quizPool.length, total - words.length - drillShare);
  const drills = drillShare ? distinct(drillDeck(data, random), total - words.length - quizCount) : [];
  return shuffled([...drills, ...quizPool.slice(0, quizCount), ...words], random);
}

export const checkpointDeck = (data: ChapterData, random: Random = Math.random) => queue(checkpointCards(data, random));

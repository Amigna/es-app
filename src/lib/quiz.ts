import type { Card } from "./drill";
import type { GuideRule } from "./guides";

/** A guide question. With `choices` it's multiple choice; without, the answer is typed. */
export interface QuizQuestion {
  q: string;
  en: string;
  choices?: string[];
  answer: string;
  why: string;
  /** The guide rule it tests, by its text. */
  rule?: string;
  /** That rule in full, attached when the quizzes are loaded, to show after a miss. */
  lesson?: GuideRule;
}

export type GuideQuizzes = Record<string, QuizQuestion[]>;

export function shuffled<T>(list: T[], random: () => number = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function quizCard(slug: string, index: number, guideTitle: string, q: QuizQuestion, random: () => number = Math.random): Card {
  return {
    id: `quiz:${slug}:${index}`,
    context: guideTitle,
    title: q.q,
    titleIsSpanish: true,
    subtitle: q.en,
    ask: q.choices ? "Choose the answer" : "Type the answer",
    answers: [q.answer],
    shown: q.answer,
    choices: q.choices && shuffled(q.choices, random),
    explain: q.why,
    // No link to the guide: a stray tap would leave the quiz. A miss shows the rule instead.
    ...(q.lesson ? { lesson: q.lesson } : {}),
    track: { item: `quiz:${slug}:${index}` },
  };
}

/** Questions asked in one run of a guide's quiz, so a retake isn't a memory test. Bigger quizzes are drawn from. */
export const QUIZ_RUN = 12;

/** Question positions per guide, most recently asked last, as kept in this browser by quiz-seen. */
export type QuizSeen = Record<string, number[]>;

/** A quiz card's guide and position, from its saved item `quiz:<slug>:<index>`. */
export function quizPlace(card: Card): [string, number] | null {
  const match = /^quiz:(.+):(\d+)$/.exec(card.track?.item ?? "");
  return match ? [match[1], Number(match[2])] : null;
}

/** Shuffled, then questions never asked here first, then the ones asked longest ago. */
export function freshestFirst(cards: Card[], seen: QuizSeen = {}, random: () => number = Math.random): Card[] {
  const rank = (card: Card) => {
    const place = quizPlace(card);
    return place ? (seen[place[0]] ?? []).indexOf(place[1]) : -1;
  };
  // Sorting is stable, so cards of equal rank keep their shuffled order.
  return shuffled(cards, random)
    .map((card) => ({ card, rank: rank(card) }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ card }) => card);
}

/**
 * Up to `perGuide` questions from each guide, freshest first, in random order. The deck runs out, which ends the quiz.
 * Without `perGuide`, every question once.
 */
export function quizDeck(
  quizzes: GuideQuizzes,
  guides: { slug: string; title: string }[],
  random: () => number = Math.random,
  { seen = {}, perGuide = Infinity }: { seen?: QuizSeen; perGuide?: number } = {},
): () => Card | null {
  const cards = guides.flatMap((g) =>
    freshestFirst(
      (quizzes[g.slug] ?? []).map((q, i) => quizCard(g.slug, i, g.title, q, random)),
      seen,
      random,
    ).slice(0, perGuide),
  );
  const queue = shuffled(cards, random);
  return () => queue.shift() ?? null;
}

import type { Card } from "./drill";

/** A guide question. With `choices` it's multiple choice; without, the answer is typed. */
export interface QuizQuestion {
  q: string;
  en: string;
  choices?: string[];
  answer: string;
  why: string;
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
    link: { href: `/guides/${slug}`, label: `Read the guide: ${guideTitle}` },
  };
}

/** Every question once, in random order. The deck runs out, which ends the quiz. */
export function quizDeck(
  quizzes: GuideQuizzes,
  guides: { slug: string; title: string }[],
  random: () => number = Math.random,
): () => Card | null {
  const cards = guides.flatMap((g) => (quizzes[g.slug] ?? []).map((q, i) => quizCard(g.slug, i, g.title, q, random)));
  const queue = shuffled(cards, random);
  return () => queue.shift() ?? null;
}

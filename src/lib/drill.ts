import { stripAccents } from "./conjugation/accent";
import { conjugate } from "./conjugation/engine";
import { IRREGULARS } from "./conjugation/irregulars";
import { TENSES, type TenseId } from "./conjugation/types";
import type { Track } from "./progress";
import { blankOut, type Sentence } from "./sentences";
import { verbSlug, type Verb } from "./verbs";

export type VerbPool = "common" | "irregular" | "all";

/** The seed list is ordered by frequency, so the head of it is the common set. */
export const COMMON_COUNT = 50;

export const CORE_TENSES: TenseId[] = ["present", "preterite", "imperfect", "future", "conditional", "subjPresent"];

// Verbs that are only natural in the third person: nobody needs to practice "yo lluevo".
const ONLY_PERSONS: Record<string, number[]> = {
  llover: [2],
  nevar: [2],
  gustar: [2, 4],
  doler: [2, 4],
  ocurrir: [2, 4],
  existir: [2, 4],
  resultar: [2, 4],
  convenir: [2, 4],
  costar: [2, 4],
};

const PERSONS = ["yo", "tú", "él / ella / usted", "nosotros", "ellos / ustedes"];
const IMPERATIVE_PERSONS = ["", "tú", "usted", "nosotros", "ustedes"];

export interface Question {
  verb: Verb;
  tense: TenseId;
  person: number;
  label: string;
  answer: string;
}

export type Grade = "correct" | "accent" | "wrong";

export function isIrregular(v: Verb): boolean {
  return !!(v.like || v.boot || IRREGULARS[v.inf.replace(/se$/, "")]);
}

export function poolVerbs(verbs: Verb[], pool: VerbPool): Verb[] {
  if (pool === "common") return verbs.slice(0, COMMON_COUNT);
  if (pool === "irregular") return verbs.filter(isIrregular);
  return verbs;
}

export const rareKey = (inf: string, tense: TenseId) => `${inf}:${tense}`;

/** Every drillable question for one verb and tense; empty when the tense is rare or has no forms. */
function questionsFor(verb: Verb, tense: TenseId, rare: Set<string>): Question[] {
  if (rare.has(rareKey(verb.inf, tense))) return [];
  const forms = conjugate(verb).tenses[tense]?.forms ?? [];
  const allowed = ONLY_PERSONS[verb.inf];
  const out: Question[] = [];
  forms.forEach((answer, person) => {
    const label = personLabel(tense, person);
    if (!answer || !label || (allowed && !allowed.includes(person))) return;
    out.push({ verb, tense, person, label, answer });
  });
  return out;
}

export function makeQuestion(
  verbs: Verb[],
  tenses: TenseId[],
  rare: Set<string>,
  random: () => number = Math.random,
): Question | null {
  if (verbs.length === 0 || tenses.length === 0) return null;
  // A random pick can land on a rare tense, so retry before scanning everything.
  for (let i = 0; i < 40; i++) {
    const verb = verbs[Math.floor(random() * verbs.length)];
    const tense = tenses[Math.floor(random() * tenses.length)];
    const options = questionsFor(verb, tense, rare);
    if (options.length > 0) return options[Math.floor(random() * options.length)];
  }
  for (const verb of verbs) {
    for (const tense of tenses) {
      const options = questionsFor(verb, tense, rare);
      if (options.length > 0) return options[0];
    }
  }
  return null;
}

/** One thing to answer, whatever the drill. Accepted answers are checked in order of how well they match. */
export interface Card {
  id: string;
  /** Bold label above the prompt for what's being asked, e.g. the tense or question type. */
  badge?: string;
  /** Small text above the prompt, beside the badge when there is one. */
  context?: string;
  title: string;
  titleIsSpanish: boolean;
  subtitle?: string;
  example?: { es: string; en: string };
  ask: string;
  answers: string[];
  /** The answer as shown after a miss. */
  shown: string;
  /** English answers are compared loosely, with no accent feedback. */
  english?: boolean;
  /** Present for multiple choice instead of typing. */
  choices?: string[];
  /** Why the answer is right, shown after answering. */
  explain?: string;
  /** What this question counts toward in saved progress. */
  track?: Track;
  link?: { href: string; label: string };
}

/** An example only shows when it's written for the person asked, so the blank is always the answer. */
export function conjugationCard(q: Question, sentences: Sentence[] = []): Card {
  const meta = TENSES.find((t) => t.id === q.tense)!;
  const sentence = sentences.find((s) => s.person === q.person);
  return {
    id: `${q.verb.inf}:${q.tense}:${q.person}`,
    badge: meta.name,
    context: meta.hint,
    title: q.verb.inf,
    titleIsSpanish: true,
    subtitle: q.verb.en,
    example: sentence && { es: blankOut(sentence.es, q.answer), en: sentence.en },
    ask: `Form for ${q.label}`,
    answers: [q.answer],
    shown: q.answer,
    link: { href: `/verb/${verbSlug(q.verb.inf)}`, label: `See all forms of ${q.verb.inf}` },
    track: verbTrack(q.verb.inf, q.tense),
  };
}

/** Conjugation and fill-in-the-blank share an item, so either one counts as practicing that verb and tense. */
export const verbTrack = (inf: string, tense: TenseId): Track => ({ item: `verb:${inf}:${tense}`, tense });

/** Ends a deck that would otherwise go on forever. */
export function limitedDeck(next: () => Card | null, size: number): () => Card | null {
  let left = size;
  return () => (left-- > 0 ? next() : null);
}

export function personLabel(tense: TenseId, person: number): string {
  return (tense === "impAffirmative" || tense === "impNegative" ? IMPERATIVE_PERSONS : PERSONS)[person] ?? "";
}

const clean = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const loose = (s: string) => stripAccents(clean(s)).replace(/ü/g, "u");

/** Right letters with a missing or wrong accent is its own result, so it can be taught instead of marked wrong. */
export function grade(input: string, answer: string): Grade {
  if (clean(input) === clean(answer)) return "correct";
  return loose(input) === loose(answer) ? "accent" : "wrong";
}

/** Reduces an English gloss or answer to its core: "to say" -> "say", "the house" -> "house". */
export function englishCore(text: string): string {
  return clean(text.replace(/\(.*?\)/g, " "))
    .replace(/[.!?]/g, "")
    .replace(/^(to|the|a|an) /, "")
    .trim();
}

/** Every acceptable reading of a gloss like "to say, to tell" or "want; love". */
export const englishAnswers = (gloss: string) => gloss.split(/[,;]/).map(englishCore).filter(Boolean);

export function gradeCard(card: Card, input: string): Grade {
  if (card.english) return card.answers.includes(englishCore(input)) ? "correct" : "wrong";
  const grades = card.answers.map((a) => grade(input, a));
  if (grades.includes("correct")) return "correct";
  return grades.includes("accent") ? "accent" : "wrong";
}

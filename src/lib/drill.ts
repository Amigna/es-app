import { stripAccents } from "./conjugation/accent";
import { conjugate } from "./conjugation/engine";
import { IRREGULARS } from "./conjugation/irregulars";
import { TENSES, type TenseId } from "./conjugation/types";
import type { Track } from "./progress";
import { blankOut, type Sentence } from "./sentences";
import type { Verb } from "./verbs";

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
  /** The tense to show in full after a miss, with the person asked marked. */
  table?: TenseTable;
  /** Present on a card you flip and grade yourself instead of answering. Shown with the answer. */
  flashcard?: { example?: { es: string; en: string }; note?: string };
  /** A sentence to translate. Many answers can be right, so one that doesn't match is compared by the learner. */
  writing?: boolean;
  /** A sentence to hear and type. The audio is the prompt, so it's spoken from the start; `en` shows after answering. */
  dictation?: { en: string };
  /**
   * Real words that an accent slip could turn the answer into, like hablo for habló. Typing one is a wrong answer, not
   * a slip. Usually every form of the card's verb, or every word in the lists.
   */
  lookalikes?: readonly string[];
}

/** Pairs where the accent alone tells two common words apart: tú and tu, qué and que, está and esta. */
const ACCENT_PAIRS = [
  "tu tú", "el él", "si sí", "mi mí", "te té", "de dé", "se sé", "mas más", "aun aún",
  "que qué", "como cómo", "donde dónde", "cuando cuándo", "quien quién", "quienes quiénes", "cual cuál", "cuales cuáles",
  "cuanto cuánto", "cuanta cuánta", "cuantos cuántos", "cuantas cuántas", "adonde adónde", "esta está", "estas estás", "este esté",
];
const PAIRED_WORDS = new Set(ACCENT_PAIRS.flatMap((pair) => pair.split(" ")));

/** Every form of a verb in every tense, for `lookalikes`. Voseo is left out, since it's optional. */
export function verbForms(verb: Verb): string[] {
  const out = new Set<string>();
  for (const forms of Object.values(conjugate(verb).tenses)) for (const form of forms?.forms ?? []) if (form) out.add(form);
  return [...out];
}

export interface TenseTable {
  verb: Verb;
  tense: TenseId;
  person: number;
  sentence?: Sentence;
}

/** The table's example is the tense's main sentence, the one the verb page shows, unless the card already used it. */
export function tenseTable(verb: Verb, tense: TenseId, person: number, sentences: Sentence[], used?: Sentence): TenseTable {
  const main = sentences[0];
  return { verb, tense, person, ...(main && main !== used ? { sentence: main } : {}) };
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
    ask: `${meta.name} · ${q.label}`,
    answers: [q.answer],
    shown: q.answer,
    table: tenseTable(q.verb, q.tense, q.person, sentences, sentence),
    track: verbTrack(q.verb.inf, q.tense),
    lookalikes: verbForms(q.verb),
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

/** Sentences are compared on their words, so a missing period or a phone's curly apostrophe doesn't matter. */
const wordsOnly = (s: string) => s.replace(/[’‘]/g, "'").replace(/[.,;:!?¿¡"“”]/g, " ");

export type WordMark = "ok" | "accent" | "missed";

/**
 * The answer's words, each marked by whether the input had it: a longest common run of words, compared loosely so an
 * accent slip still lines up. Words the learner added don't show, since the point is what they didn't catch.
 */
export function wordDiff(input: string, answer: string): { word: string; mark: WordMark; typed?: string }[] {
  const shown = answer.split(/\s+/).filter(Boolean);
  const key = (w: string) => clean(wordsOnly(w)).replace(/\s+/g, "");
  const want = shown.map(key);
  const got = clean(wordsOnly(input)).split(" ").filter(Boolean);
  const [a, b] = [want.map((w) => loose(w)), got.map((w) => loose(w))];
  // lengths[i][j]: longest common run of a[i..] and b[j..].
  const lengths = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i][j] = a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const marks: WordMark[] = new Array(a.length).fill("missed");
  const typed: (string | undefined)[] = new Array(a.length).fill(undefined);
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) {
      marks[i] = want[i] === got[j] ? "ok" : "accent";
      typed[i] = got[j];
      i++;
      j++;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) i++;
    else j++;
  }
  return shown.map((word, i) => ({ word, mark: marks[i], ...(typed[i] === undefined ? {} : { typed: typed[i] }) }));
}

/** The answer's words against what was typed. Single answers are compared as one string; sentences ignore punctuation. */
const compare = (card: Card, input: string, answer: string): Grade =>
  card.dictation || card.writing ? grade(wordsOnly(input), wordsOnly(answer)) : grade(input, answer);

/**
 * A typed word that differs from the answer only by its accent and is a real word in its own right, like hablo for
 * habló or esta for está. That's a different word, not a slip. Null when every accent slip is just a slip.
 */
export function accentTrap(card: Card, input: string): string | null {
  if (card.english) return null;
  const answer = card.answers.find((a) => compare(card, input, a) === "accent");
  if (!answer) return null;
  const known = new Set([...PAIRED_WORDS, ...(card.lookalikes ?? []).flatMap((f) => clean(f).split(" "))]);
  const trap = wordDiff(input, answer).find((w) => w.mark === "accent" && w.typed && known.has(w.typed));
  return trap?.typed ?? null;
}

export function gradeCard(card: Card, input: string): Grade {
  const result = gradeLoosely(card, input);
  return result === "accent" && accentTrap(card, input) ? "wrong" : result;
}

function gradeLoosely(card: Card, input: string): Grade {
  if (card.dictation) return compare(card, input, card.answers[0]);
  if (card.writing) {
    const result = compare(card, input, card.answers[0]);
    return card.english && result === "accent" ? "correct" : result;
  }
  if (card.english) return card.answers.includes(englishCore(input)) ? "correct" : "wrong";
  const grades = card.answers.map((a) => grade(input, a));
  if (grades.includes("correct")) return "correct";
  return grades.includes("accent") ? "accent" : "wrong";
}

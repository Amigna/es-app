import { stripAccents } from "./conjugation/accent";
import { conjugate } from "./conjugation/engine";
import { IRREGULARS } from "./conjugation/irregulars";
import type { TenseId } from "./conjugation/types";
import type { Verb } from "./verbs";

export type VerbPool = "common" | "irregular" | "all";

/** The seed list is ordered by frequency, so the head of it is the common set. */
const COMMON_COUNT = 50;

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

const rareKey = (inf: string, tense: TenseId) => `${inf}:${tense}`;

/** Every drillable question for one verb and tense; empty when the tense is rare or has no forms. */
function questionsFor(verb: Verb, tense: TenseId, rare: Set<string>): Question[] {
  if (rare.has(rareKey(verb.inf, tense))) return [];
  const forms = conjugate(verb).tenses[tense]?.forms ?? [];
  const labels = tense.startsWith("imp") && tense !== "imperfect" ? IMPERATIVE_PERSONS : PERSONS;
  const allowed = ONLY_PERSONS[verb.inf];
  const out: Question[] = [];
  forms.forEach((answer, person) => {
    if (!answer || !labels[person] || (allowed && !allowed.includes(person))) return;
    out.push({ verb, tense, person, label: labels[person], answer });
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

const clean = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const loose = (s: string) => stripAccents(clean(s)).replace(/ü/g, "u");

/** Right letters with a missing or wrong accent is its own result, so it can be taught instead of marked wrong. */
export function grade(input: string, answer: string): Grade {
  if (clean(input) === clean(answer)) return "correct";
  return loose(input) === loose(answer) ? "accent" : "wrong";
}

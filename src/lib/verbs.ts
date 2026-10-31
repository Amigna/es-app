import raw from "../data/verbs.json";
import { stripAccents } from "./conjugation/accent";
import type { VerbInput } from "./conjugation/types";

// Search and lookup over the seed list. Kept free of the conjugation engine so it is cheap to ship to the browser.

export interface Verb extends VerbInput {
  en: string;
}

export const VERBS = raw as Verb[];

export const VERB_SHAPE = /^([a-zñáéíóúü]+(ar|er|ir|ír)|ir)(se)?$/;

const norm = (s: string) => stripAccents(s.trim().toLowerCase());
const byInf = new Map(VERBS.map((v) => [norm(v.inf), v]));

/** URL-safe key for a verb: accents stripped (oír -> oir). */
export const verbSlug = norm;

export function findVerb(q: string): Verb | undefined {
  return byInf.get(norm(q));
}

/** Infinitive prefix first, then substring, then English gloss. */
export function searchVerbs(q: string, limit = 8): Verb[] {
  const n = norm(q);
  if (!n) return [];
  const gq = q.trim().toLowerCase();
  const starts: Verb[] = [];
  const contains: Verb[] = [];
  const gloss: Verb[] = [];
  for (const v of VERBS) {
    const inf = norm(v.inf);
    if (inf.startsWith(n)) starts.push(v);
    else if (inf.includes(n)) contains.push(v);
    else if (v.en.toLowerCase().includes(gq)) gloss.push(v);
  }
  return [...starts, ...contains, ...gloss].slice(0, limit);
}

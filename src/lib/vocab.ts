import adjectivesRaw from "../data/vocab/adjectives.json";
import adverbsRaw from "../data/vocab/adverbs.json";
import levelsRaw from "../data/vocab/levels.json";
import nounsRaw from "../data/vocab/nouns.json";
import phrasesRaw from "../data/vocab/phrases.json";
import smallWordsRaw from "../data/vocab/small-words.json";
import { nuclei, setStress, stressIndex } from "./conjugation/accent";
import type { Level } from "./level";
import { LEVEL_ORDER, atOrBelow } from "./level-order";

export interface Example {
  es: string;
  en: string;
}

export interface Noun {
  es: string;
  gender: "m" | "f";
  en: string;
  topic: string;
  ex: Example;
  /** Irregular plural, or the same word for lunes-type nouns. */
  plural?: string;
  /** El before a feminine noun with stressed a (el agua), los for words used in the plural (los lentes), or the shown article where gender is no drill: el dentista is also la dentista. */
  article?: string;
  /** Shown on the browse page, for words that mean something else in some countries. */
  note?: string;
}

export interface Adjective {
  es: string;
  en: string;
  ex: Example;
  /** Feminine form when it isn't just -o -> -a or unchanged: trabajadora. */
  feminine?: string;
}

export interface Adverb {
  es: string;
  en: string;
  ex: Example;
}

/** Prepositions, conjunctions, pronouns, question words, articles and numbers. */
export interface SmallWord {
  es: string;
  en: string;
  topic: string;
  ex: Example;
  note?: string;
  /** Other forms, shown when browsing: esta, estos, estas, or "plural sus". */
  forms?: string;
}

/** The spellings in a small word's forms, without the "plural" label: "plural sus" -> ["sus"]. */
export const smallWordForms = (w: SmallWord): string[] =>
  (w.forms ?? "")
    .split(",")
    .map((f) => f.trim().replace(/^plural /, ""))
    .filter(Boolean);

export interface Phrase {
  es: string;
  en: string;
  topic: string;
  note?: string;
}

export const NOUNS = nounsRaw as Noun[];
export const ADJECTIVES = adjectivesRaw as Adjective[];
export const ADVERBS = adverbsRaw as Adverb[];
export const SMALL_WORDS = smallWordsRaw as SmallWord[];
export const PHRASES = phrasesRaw as Phrase[];

/** The lists that have levels. Phrases don't: they're everyday expressions, open to everyone. */
export type LeveledType = "noun" | "adjective" | "adverb" | "small";

// Judged by frequency and by the topics beginners learn first, from levels.json. Each level includes the ones before.
const WORD_LEVELS = levelsRaw as Record<LeveledType, Record<Level, string[]>>;
const levelOf = new Map(
  Object.entries(WORD_LEVELS).flatMap(([type, levels]) =>
    Object.entries(levels).flatMap(([level, words]) => words.map((es) => [`${type}|${es}`, level as Level] as const)),
  ),
);

/** Words missing from levels.json count as the hardest, so a new word never lands in a beginner's drill by accident. */
export const wordLevel = (type: LeveledType, es: string): Level => levelOf.get(`${type}|${es}`) ?? "B2";

/** Whether a word is at or below the level. With no level, every word is. */
export const upToLevel = (level: Level | null | undefined, type: LeveledType, es: string): boolean =>
  atOrBelow(wordLevel(type, es), level);

/** For sorting easiest first. */
export const levelRank = (type: LeveledType, es: string): number => LEVEL_ORDER.indexOf(wordLevel(type, es));

/** Regular plural, keeping the stress on the same syllable: joven -> jóvenes, camión -> camiones, lápiz -> lápices. */
export function pluralOf(word: string): string {
  if (/[aeiouáéó]$/.test(word)) return word + "s";
  const stress = stressIndex(word);
  // Unstressed final -s doesn't change: el lunes, los lunes; gratis.
  if (word.endsWith("s") && stress < nuclei(word).length - 1) return word;
  const stem = word.endsWith("z") ? word.slice(0, -1) + "c" : word;
  return setStress(stem + "es", stress);
}

export const nounPlural = (n: Noun) => n.plural ?? pluralOf(n.es);
export const nounArticle = (n: Noun) => n.article ?? (n.gender === "m" ? "el" : "la");
export const isPluralOnly = (n: Noun) => /^l[ao]s$/.test(nounArticle(n));

/** Masculine, feminine, masculine plural, feminine plural. */
export function adjectiveForms(a: Adjective): [string, string, string, string] {
  const feminine = a.feminine ?? (a.es.endsWith("o") ? a.es.slice(0, -1) + "a" : a.es);
  return [a.es, feminine, pluralOf(a.es), pluralOf(feminine)];
}

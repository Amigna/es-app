import adjectivesRaw from "../data/vocab/adjectives.json";
import adverbsRaw from "../data/vocab/adverbs.json";
import nounsRaw from "../data/vocab/nouns.json";
import phrasesRaw from "../data/vocab/phrases.json";
import { nuclei, setStress, stressIndex } from "./conjugation/accent";

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
  /** El before a feminine noun with stressed a (el agua), or los for words used in the plural (los lentes). */
  article?: string;
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

export interface Phrase {
  es: string;
  en: string;
  topic: string;
  note?: string;
}

export const NOUNS = nounsRaw as Noun[];
export const ADJECTIVES = adjectivesRaw as Adjective[];
export const ADVERBS = adverbsRaw as Adverb[];
export const PHRASES = phrasesRaw as Phrase[];

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

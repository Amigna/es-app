import { TENSES, type Conjugation, type TenseId } from "./conjugation/types";

/** An example for one tense. `person` is the slot in TenseForms.forms (0 yo ... 4 ellos/ustedes). */
export interface Sentence {
  person: number;
  es: string;
  en: string;
}

/** Marks a tense that exists but sounds unnatural for this verb, so a forced example would teach the wrong thing. */
export interface RareTense {
  rare: true;
}

export type VerbSentences = Partial<Record<TenseId, Sentence | RareTense>>;

const words = (text: string) => text.split(" ").join("\\s+");

/** Locates a conjugated form in a sentence as whole words. "no digas" also matches "no me digas". */
export function findForm(sentence: string, form: string): { start: number; end: number } | null {
  const body = form.startsWith("no ")
    ? `no\\s+(?:(?:me|te|se|lo|la|le|nos|los|las|les)\\s+){0,2}${words(form.slice(3))}`
    : words(form);
  const match = new RegExp(`(?<!\\p{L})${body}(?!\\p{L})`, "iu").exec(sentence);
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}

/** Everything wrong with a verb's sentence file; empty means it is complete and consistent with the engine. */
export function checkSentences(conjugation: Conjugation, data: VerbSentences): string[] {
  const problems: string[] = [];
  const known = new Set<string>(TENSES.map((t) => t.id));
  for (const key of Object.keys(data)) if (!known.has(key)) problems.push(`unknown tense "${key}"`);

  for (const { id } of TENSES) {
    const forms = conjugation.tenses[id]?.forms ?? [];
    const available = forms.some(Boolean);
    const s = data[id];
    if (!available) {
      if (s) problems.push(`${id}: this verb has no such forms`);
      continue;
    }
    if (!s) {
      problems.push(`${id}: missing`);
      continue;
    }
    if ("rare" in s) continue;
    const form = forms[s.person];
    if (!form) {
      problems.push(`${id}: no form for person ${s.person}`);
      continue;
    }
    if (!findForm(s.es, form)) problems.push(`${id}: "${s.es}" does not contain "${form}"`);
    if (!/[.?!]$/.test(s.es)) problems.push(`${id}: Spanish needs end punctuation`);
    if (!/[.?!]$/.test(s.en)) problems.push(`${id}: English needs end punctuation`);
  }
  return problems;
}

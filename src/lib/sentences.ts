import { TENSES, type Conjugation, type TenseId } from "./conjugation/types";
import type { Level } from "./level";
import { atOrBelow } from "./level-order";

/** An example for one tense. `person` is the slot in TenseForms.forms (0 yo ... 4 ellos/ustedes). */
export interface Sentence {
  person: number;
  es: string;
  en: string;
  /** Set when the sentence also uses a tense from a higher level than its own (si tuviéramos in a conditional one), so writing and dictation skip it below that level. Checked by a test. */
  level?: Level;
}

/** Marks a tense that exists but sounds unnatural for this verb, so a forced example would teach the wrong thing. */
export interface RareTense {
  rare: true;
}

/** The main sentence for each tense, which is what the verb page shows. */
export type VerbSentences = Partial<Record<TenseId, Sentence | RareTense>>;

/** Sentences by infinitive and tense. The first in each list is the main one, and the rest cover other persons. */
export type SentenceBank = Record<string, Partial<Record<TenseId, Sentence[] | RareTense>>>;

/** Every example for a verb and tense, main sentence first; empty when the tense is rare or has none. */
export function sentencesFor(bank: SentenceBank, inf: string, tense: TenseId): Sentence[] {
  const entry = bank[inf]?.[tense];
  return Array.isArray(entry) ? entry : [];
}

/** The bank without sentences above the level, for drills that show the whole sentence. No level keeps every one. */
export function sentencesUpTo(bank: SentenceBank, level: Level | null | undefined): SentenceBank {
  if (!level) return bank;
  return Object.fromEntries(
    Object.entries(bank).map(([inf, tenses]) => [
      inf,
      Object.fromEntries(Object.entries(tenses).map(([tense, entry]) => [tense, Array.isArray(entry) ? entry.filter((s) => !s.level || atOrBelow(s.level, level)) : entry])),
    ]),
  );
}

/**
 * The bank with more sentences added after each list, like a course chapter's own. Those can repeat a person, which
 * the bank itself doesn't, so they stay out of verb pages and tense tables.
 */
export function withExtraSentences(bank: SentenceBank, extra: SentenceBank): SentenceBank {
  const out: SentenceBank = { ...bank };
  for (const [inf, tenses] of Object.entries(extra)) {
    out[inf] = { ...bank[inf] };
    for (const [tense, rows] of Object.entries(tenses) as [TenseId, Sentence[]][]) out[inf][tense] = [...sentencesFor(bank, inf, tense), ...rows];
  }
  return out;
}

const words = (text: string) => text.split(" ").join("\\s+");

/** Locates a conjugated form in a sentence as whole words. "no digas" also matches "no me digas". */
export function findForm(sentence: string, form: string): { start: number; end: number } | null {
  const body = form.startsWith("no ")
    ? `no\\s+(?:(?:me|te|se|lo|la|le|nos|los|las|les)\\s+){0,2}${words(form.slice(3))}`
    : words(form);
  const match = new RegExp(`(?<!\\p{L})${body}(?!\\p{L})`, "iu").exec(sentence);
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}

export const BLANK = "_____";

/** Blanks every copy of the given forms, so a verb used twice can't give the answer away. */
export function blankOut(sentence: string, ...forms: string[]): string {
  let out = sentence;
  for (const form of forms) {
    for (let hit = findForm(out, form); hit; hit = findForm(out, form)) {
      out = out.slice(0, hit.start) + BLANK + out.slice(hit.end);
    }
  }
  return out;
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

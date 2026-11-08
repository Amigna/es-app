import { conjugate } from "./conjugation/engine";
import type { TenseId } from "./conjugation/types";
import { LEVELS, type Level } from "./level";
import { LEVEL_ORDER } from "./level-order";
import type { Sentence } from "./sentences";
import type { Verb } from "./verbs";
import { ADJECTIVES, ADVERBS, NOUNS, SMALL_WORDS, pluralOf } from "./vocab";

// Writing and dictation show a whole sentence, so a present-tense card with "si tuviéramos" in it asks a beginner for a
// tense they haven't met. A sentence that uses a tense from a higher level than its own carries that level in `level`,
// and those drills skip it below that level. Worked out here for the tests, not in the browser.

/** The first level whose drill includes the tense. */
export const tenseLevel = (tense: TenseId): Level => LEVELS.find((l) => l.tenses.includes(tense))?.id ?? "B2";

const PRONOUN = /^(me|te|se|nos|os|no)$/;

/** Every verb form, as one word or "auxiliary participle", with the tenses it belongs to. */
export function formTenses(verbs: Verb[]): Map<string, Set<TenseId>> {
  const index = new Map<string, Set<TenseId>>();
  for (const verb of verbs) {
    for (const [tense, forms] of Object.entries(conjugate(verb).tenses)) {
      for (const form of [...forms.forms, forms.vos]) {
        if (!form) continue;
        const parts = form.toLowerCase().split(/\s+/).filter((p) => !PRONOUN.test(p));
        const key = parts.slice(-2).join(" ");
        if (!index.has(key)) index.set(key, new Set());
        index.get(key)!.add(tense as TenseId);
      }
    }
  }
  return index;
}

/** Words in sentences that look like a verb form but aren't one here, and aren't in the word lists. */
const NOT_VERBS = ["andes", "apuntes", "cobre", "mate", "monte", "tejas"];

/** Nouns and adjectives spelled like a verb form (las tardes, agua fría), so they aren't read as one. */
export function wordForms(): Set<string> {
  const words = new Set<string>(NOT_VERBS);
  for (const w of [...NOUNS, ...ADJECTIVES, ...ADVERBS, ...SMALL_WORDS]) {
    const es = w.es.toLowerCase();
    const feminine = ("feminine" in w && typeof w.feminine === "string" && w.feminine) || (es.endsWith("o") ? `${es.slice(0, -1)}a` : es);
    const plural = ("plural" in w && typeof w.plural === "string" && w.plural) || pluralOf(es);
    for (const form of [es, feminine, plural, pluralOf(feminine)]) for (const part of form.split(/\s+/)) words.add(part);
  }
  return words;
}

/** The level a sentence needs for writing and dictation, when it's above the level of its own tense. */
export function sentenceLevel(sentence: Sentence, tense: TenseId, forms: Map<string, Set<TenseId>>, words: Set<string>): Level | undefined {
  const tokens = sentence.es
    .toLowerCase()
    .replace(/[¿?¡!.,;:"«»()—]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  let needed = LEVEL_ORDER.indexOf(tenseLevel(tense));
  const own = needed;
  const check = (key: string) => {
    const tenses = forms.get(key);
    if (!tenses || (!key.includes(" ") && words.has(key))) return;
    // A form shared by several tenses (hablamos) needs only the easiest of them.
    needed = Math.max(needed, Math.min(...[...tenses].map((t) => LEVEL_ORDER.indexOf(tenseLevel(t)))));
  };
  tokens.forEach((token, i) => {
    check(token);
    if (i > 0) check(`${tokens[i - 1]} ${token}`);
  });
  return needed > own ? LEVEL_ORDER[needed] : undefined;
}

import ar from "../data/sentences/ar.json";
import er from "../data/sentences/er.json";
import ir from "../data/sentences/ir.json";
import persons from "../data/sentences/persons.json";
import { sentenceGroup, type PersonSentences, type VerbSentences } from "./sentences";

// Example sentences, grouped by verb ending and keyed by infinitive (reflexives file under their ending: levantarse -> ar).
// Large: import this on the server, or dynamically from the browser.

export type SentenceGroups = Record<string, Record<string, VerbSentences>>;

export const SENTENCE_GROUPS = { ar, er, ir } as SentenceGroups;

/** The sentences above plus, for common verbs, one for each other person. */
export interface SentenceBank {
  groups: SentenceGroups;
  persons: PersonSentences;
}

export const SENTENCE_BANK: SentenceBank = { groups: SENTENCE_GROUPS, persons: persons as PersonSentences };

export function getSentences(inf: string): VerbSentences | null {
  return SENTENCE_GROUPS[sentenceGroup(inf)]?.[inf] ?? null;
}

import ar from "../data/sentences/ar.json";
import er from "../data/sentences/er.json";
import ir from "../data/sentences/ir.json";
import { sentenceGroup, type VerbSentences } from "./sentences";

// Example sentences, grouped by verb ending and keyed by infinitive (reflexives file under their ending: levantarse -> ar).
// Large: import this on the server, or dynamically from the browser.

export type SentenceGroups = Record<string, Record<string, VerbSentences>>;

export const SENTENCE_GROUPS = { ar, er, ir } as SentenceGroups;

export function getSentences(inf: string): VerbSentences | null {
  return SENTENCE_GROUPS[sentenceGroup(inf)]?.[inf] ?? null;
}

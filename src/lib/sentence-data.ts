import ar from "../data/sentences/ar.json";
import er from "../data/sentences/er.json";
import ir from "../data/sentences/ir.json";
import type { VerbSentences } from "./sentences";

// Example sentences, grouped by verb ending and keyed by infinitive (reflexives file under their ending: levantarse -> ar).
// Server-only in practice: pages pass just the current verb's entry to the browser.

export const SENTENCE_GROUPS = { ar, er, ir } as Record<string, Record<string, VerbSentences>>;

/** Which file a verb belongs in: levantarse -> ar, oír -> ir. */
export function sentenceGroup(inf: string): string {
  return inf.replace(/se$/, "").slice(-2).replace("ír", "ir");
}

export function getSentences(inf: string): VerbSentences | null {
  return SENTENCE_GROUPS[sentenceGroup(inf)]?.[inf] ?? null;
}

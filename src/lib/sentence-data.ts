import file1 from "../data/sentences/verbs-001-050.json";
import file2 from "../data/sentences/verbs-051-100.json";
import file3 from "../data/sentences/verbs-101-150.json";
import file4 from "../data/sentences/verbs-151-200.json";
import file5 from "../data/sentences/verbs-201-250.json";
import file6 from "../data/sentences/verbs-251-300.json";
import file7 from "../data/sentences/verbs-301-350.json";
import file8 from "../data/sentences/verbs-351-400.json";
import file9 from "../data/sentences/verbs-401-450.json";
import file10 from "../data/sentences/verbs-451-500.json";
import file11 from "../data/sentences/verbs-501-550.json";
import file12 from "../data/sentences/verbs-551-600.json";
import file13 from "../data/sentences/verbs-601-650.json";
import file14 from "../data/sentences/verbs-651-700.json";
import type { SentenceBank, VerbSentences } from "./sentences";

// Every example sentence. Large: server only. The browser uses sentence-loader.ts, which fetches only what a drill needs.

export const SENTENCE_FILES = [file1, file2, file3, file4, file5, file6, file7, file8, file9, file10, file11, file12, file13, file14] as SentenceBank[];

export const SENTENCE_BANK: SentenceBank = Object.assign({}, ...SENTENCE_FILES);

export function getSentences(inf: string): VerbSentences | null {
  const entry = SENTENCE_BANK[inf];
  if (!entry) return null;
  return Object.fromEntries(Object.entries(entry).map(([tense, value]) => [tense, Array.isArray(value) ? value[0] : value]));
}

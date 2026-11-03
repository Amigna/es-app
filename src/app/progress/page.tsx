import type { Metadata } from "next";
import ProgressView from "@/components/ProgressView";
import { ADJECTIVES, ADVERBS, NOUNS, PHRASES, SMALL_WORDS } from "@/lib/vocab";

export const metadata: Metadata = { title: "Progress" };

// Only the counts reach the browser, so this page doesn't download the word lists.
const WORD_LISTS = [
  { type: "noun", title: "Nouns", total: NOUNS.length },
  { type: "adjective", title: "Adjectives", total: ADJECTIVES.length },
  { type: "adverb", title: "Adverbs", total: ADVERBS.length },
  { type: "small", title: "Small words", total: SMALL_WORDS.length },
  { type: "phrase", title: "Phrases", total: PHRASES.length },
];

export default function ProgressPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Your progress</h1>
      <ProgressView wordLists={WORD_LISTS} />
    </div>
  );
}

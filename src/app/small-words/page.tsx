import type { Metadata } from "next";
import WordList from "@/components/WordList";
import { SMALL_WORDS } from "@/lib/vocab";

export const metadata: Metadata = { title: "Small words" };

export default function SmallWordsPage() {
  const rows = [...SMALL_WORDS]
    .sort((a, b) => a.es.localeCompare(b.es, "es"))
    .map((w) => ({ id: w.es, word: w.es, forms: w.forms, en: w.en, topic: w.topic, note: w.note, example: w.ex }));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Small words</h1>
        <p className="text-stone-600 dark:text-stone-400">Prepositions, conjunctions, pronouns, question words, articles and numbers.</p>
      </header>
      <WordList rows={rows} placeholder="Filter by Spanish or English…" />
    </div>
  );
}

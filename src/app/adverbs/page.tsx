import type { Metadata } from "next";
import WordList from "@/components/WordList";
import { ADVERBS } from "@/lib/vocab";

export const metadata: Metadata = { title: "Adverbs · Conjugar" };

export default function AdverbsPage() {
  const rows = [...ADVERBS]
    .sort((a, b) => a.es.localeCompare(b.es, "es"))
    .map((a) => ({ id: a.es, word: a.es, en: a.en, example: a.ex }));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Adverbs</h1>
      <WordList rows={rows} placeholder="Filter by Spanish or English…" />
    </div>
  );
}

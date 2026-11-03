import type { Metadata } from "next";
import WordList from "@/components/WordList";
import { PHRASES } from "@/lib/vocab";

export const metadata: Metadata = { title: "Phrases" };

export default function PhrasesPage() {
  const rows = PHRASES.map((p) => ({ id: p.es, word: p.es, en: p.en, topic: p.topic, note: p.note }));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Phrases</h1>
      <WordList rows={rows} placeholder="Filter by Spanish or English…" />
    </div>
  );
}

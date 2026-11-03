import type { Metadata } from "next";
import WordList from "@/components/WordList";
import { ADJECTIVES, adjectiveForms } from "@/lib/vocab";

export const metadata: Metadata = { title: "Adjectives" };

export default function AdjectivesPage() {
  const rows = [...ADJECTIVES]
    .sort((a, b) => a.es.localeCompare(b.es, "es"))
    .map((a) => {
      const forms = adjectiveForms(a);
      return { id: a.es, word: a.es, forms: [...new Set(forms)].join(", "), en: a.en, example: a.ex };
    });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Adjectives</h1>
      <WordList rows={rows} placeholder="Filter by Spanish or English…" />
    </div>
  );
}

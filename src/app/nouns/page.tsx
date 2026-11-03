import type { Metadata } from "next";
import WordList from "@/components/WordList";
import { NOUNS, isPluralOnly, nounArticle, nounPlural } from "@/lib/vocab";

export const metadata: Metadata = { title: "Nouns" };

export default function NounsPage() {
  const rows = [...NOUNS]
    .sort((a, b) => a.es.localeCompare(b.es, "es"))
    .map((n) => ({
      id: n.es,
      word: `${nounArticle(n)} ${n.es}`,
      gender: n.gender,
      forms: isPluralOnly(n) ? undefined : `plural: ${n.gender === "m" ? "los" : "las"} ${nounPlural(n)}`,
      en: n.en,
      topic: n.topic,
      note: n.note,
      example: n.ex,
    }));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Nouns</h1>
      <WordList rows={rows} placeholder="Filter by Spanish or English…" />
    </div>
  );
}

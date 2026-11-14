import type { Metadata } from "next";
import WordList from "@/components/WordList";
import { NOUNS, hasPlural, isGeoName, nounHeadword, nounPlural } from "@/lib/vocab";

export const metadata: Metadata = { title: "Nouns" };

export default function NounsPage() {
  const rows = [...NOUNS]
    .sort((a, b) => a.es.localeCompare(b.es, "es"))
    .map((n) => ({
      id: n.es,
      word: nounHeadword(n),
      // A country has no article to color (and Costa Rica's first word isn't one), so its gender is spelled out instead.
      gender: isGeoName(n) && !n.article ? undefined : n.gender,
      forms: hasPlural(n)
        ? `plural: ${n.gender === "m" ? "los" : "las"} ${nounPlural(n)}`
        : isGeoName(n)
          ? n.gender === "m" ? "masculine" : "feminine"
          : undefined,
      en: n.en,
      topic: n.topic,
      note: n.note,
      where: n.where,
      example: n.ex,
    }));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Nouns</h1>
      <WordList rows={rows} placeholder="Filter by Spanish or English…" />
    </div>
  );
}

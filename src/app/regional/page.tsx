import type { Metadata } from "next";
import RegionalCard from "@/components/RegionalCard";
import VulgarWords from "@/components/VulgarWords";
import { REGIONAL } from "@/lib/guides";

export const metadata: Metadata = { title: "Regional words" };

const TOPICS = ["careful", "getting around", "food", "home", "everyday things", "slang"];
const TITLES: Record<string, string> = {
  careful: "Be careful with these",
  "getting around": "Getting around",
  food: "Food and drink",
  home: "Around the house",
  "everyday things": "Everyday things",
  slang: "Slang",
};

export default function RegionalPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Regional words</h1>
        <p className="text-stone-600 dark:text-stone-400">
          The same thing can have a different name from country to country, and a word that&apos;s fine in one place can be
          rude in another.
        </p>
      </header>

      {TOPICS.map((topic) => (
        <section key={topic}>
          <h2 className="mb-3 text-xl font-semibold">{TITLES[topic]}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {REGIONAL.filter((r) => r.topic === topic).map((r) => (
              <RegionalCard key={r.en} entry={r} />
            ))}
          </div>
        </section>
      ))}

      <VulgarWords />
    </div>
  );
}

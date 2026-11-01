import type { Metadata } from "next";
import Drill from "@/components/Drill";
import type { TenseId } from "@/lib/conjugation/types";
import { GUIDES } from "@/lib/guides";
import { SENTENCE_BANK } from "@/lib/sentence-data";

export const metadata: Metadata = { title: "Drills · Conjugar" };

/** Tenses marked rare are not worth drilling. Only these keys reach the browser, not the sentence files. */
function rareTenses(): string[] {
  const keys: string[] = [];
  for (const [inf, tenses] of Object.entries(SENTENCE_BANK)) {
    for (const [tense, entry] of Object.entries(tenses)) {
      if (entry && "rare" in entry) keys.push(`${inf}:${tense as TenseId}`);
    }
  }
  return keys;
}

export default function DrillPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Conjugation drills</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Pick what to practice. Anything you miss comes back a few questions later.
        </p>
      </header>
      <Drill rare={rareTenses()} guideList={GUIDES.map(({ slug, title }) => ({ slug, title }))} />
    </div>
  );
}

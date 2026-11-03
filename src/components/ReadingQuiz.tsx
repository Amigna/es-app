"use client";

import { useState } from "react";
import DrillRunner from "@/components/DrillRunner";
import type { Card } from "@/lib/drill";
import { readingDeck, type Reading } from "@/lib/readings";

export default function ReadingQuiz({ reading }: { reading: Reading }) {
  const [session, setSession] = useState<{ first: Card; next: () => Card | null } | null>(null);

  // Shuffling the choices happens on click, because a random order in the server render wouldn't match the browser's.
  function start() {
    const next = readingDeck(reading);
    const first = next();
    if (first) setSession({ first, next });
  }

  if (session) return <DrillRunner first={session.first} next={session.next} onStop={() => setSession(null)} />;

  return (
    <div className="space-y-4">
      <p className="text-stone-600 dark:text-stone-400">
        {reading.questions.length} questions about the story. You can scroll back up to the text at any time.
      </p>
      <button
        type="button"
        onClick={start}
        className="h-12 rounded-xl bg-accent-700 px-6 font-medium text-white transition hover:bg-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
      >
        Start questions
      </button>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import SpeakButton from "@/components/SpeakButton";
import type { StudyCard } from "@/lib/card-decks";

/** Cards per round. The learner can keep going through the rest of the list. */
export const STUDY_ROUND = 20;

/** Only the face showing is rendered, so the other side can't show through whatever the browser does with 3D. */
function Face({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-flip-in flex min-h-52 flex-col items-center justify-center gap-3 rounded-xl border border-stone-200 bg-white p-6 text-center dark:border-stone-800 dark:bg-stone-900">
      {children}
    </div>
  );
}

function Side({ text, spanish }: { text: string; spanish: boolean }) {
  return (
    <p className="flex items-center justify-center gap-1">
      <span lang={spanish ? "es" : "en"} className="text-3xl font-semibold tracking-tight">
        {text}
      </span>
      {/* Listening shouldn't flip the card. */}
      {spanish && (
        <span onClick={(e) => e.stopPropagation()}>
          <SpeakButton text={text} />
        </span>
      )}
    </p>
  );
}

/** Flip through words with nothing graded or saved. Tap the card, Space or Enter flips it, and the arrow keys move. */
export default function StudyRunner({ cards, onStop }: { cards: StudyCard[]; onStop: () => void }) {
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const flipRef = useRef<HTMLButtonElement>(null);

  const start = round * STUDY_ROUND;
  const roundCards = cards.slice(start, start + STUDY_ROUND);
  const finished = index >= roundCards.length;
  const card = roundCards[index];
  const more = start + STUDY_ROUND < cards.length;

  function go(to: number) {
    setIndex(Math.max(0, Math.min(to, roundCards.length)));
    setFlipped(false);
  }

  useEffect(() => {
    if (!finished) flipRef.current?.focus();
  }, [index, finished]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (finished || e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (finished) {
    return (
      <section className="animate-pop-in mx-auto max-w-xl space-y-4 rounded-xl border border-t-4 border-stone-200 border-t-accent-500 bg-white p-6 text-center dark:border-stone-800 dark:bg-stone-900">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-accent-800 dark:text-accent-300">¡Muy bien!</h2>
        <p className="text-lg">You went through {roundCards.length} cards.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => go(0)}
            className="h-11 rounded-xl border border-stone-300 px-6 font-medium transition hover:border-accent-600 dark:border-stone-700"
          >
            Go through these again
          </button>
          {more && (
            <button
              type="button"
              onClick={() => {
                setRound(round + 1);
                go(0);
              }}
              className="h-11 rounded-xl bg-accent-700 px-6 font-medium text-white transition hover:bg-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            >
              Next {Math.min(STUDY_ROUND, cards.length - start - STUDY_ROUND)} cards
            </button>
          )}
          <button type="button" onClick={onStop} className="h-11 rounded-xl px-6 font-medium underline">
            Done
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between text-sm text-stone-500">
        <span className="tabular-nums">
          Card {index + 1} of {roundCards.length}
        </span>
        <button type="button" onClick={onStop} className="min-h-10 underline">
          Change settings
        </button>
      </div>

      {/* Tapping anywhere on the card flips it; the button below does the same for the keyboard. */}
      {/* The key restarts the turn animation on every flip and every new card. */}
      <div key={`${card.id}:${flipped}`} onClick={() => setFlipped(!flipped)} aria-live="polite" className="cursor-pointer">
        {!flipped ? (
          <Face>
            <p className="text-sm text-stone-500">{card.type}</p>
            <Side {...card.front} />
            <p className="text-sm text-stone-400">Tap to flip</p>
          </Face>
        ) : (
          <Face>
            <p className="text-sm text-stone-500">{card.front.text}</p>
            <Side {...card.back} />
            {card.note && <p className="text-sm text-stone-600 dark:text-stone-400">{card.note}</p>}
            {card.example && (
              <div className="flex items-start gap-1 border-l-2 border-stone-300 pl-3 text-left text-stone-600 dark:border-stone-700 dark:text-stone-400">
                <p>
                  <span lang="es" className="block font-medium text-stone-800 dark:text-stone-200">
                    {card.example.es}
                  </span>
                  {card.example.en}
                </p>
                <span onClick={(e) => e.stopPropagation()}>
                  <SpeakButton text={card.example.es} />
                </span>
              </div>
            )}
          </Face>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="h-11 rounded-xl border border-stone-300 font-medium transition hover:border-accent-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-700"
        >
          Back
        </button>
        <button
          ref={flipRef}
          type="button"
          onClick={() => setFlipped(!flipped)}
          aria-pressed={flipped}
          className="h-11 rounded-xl border border-accent-600 font-medium text-accent-800 transition hover:bg-accent-50 dark:text-accent-300 dark:hover:bg-accent-950"
        >
          Flip
        </button>
        <button
          type="button"
          onClick={() => go(index + 1)}
          className="h-11 rounded-xl bg-accent-700 font-medium text-white transition hover:bg-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          Next
        </button>
      </div>
      <p className="text-center text-sm text-stone-500">Nothing here is graded or saved. Use Flashcards when you want to test yourself.</p>
    </div>
  );
}

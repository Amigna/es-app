"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gradeCard, type Card, type Grade } from "@/lib/drill";

const SPECIAL_LETTERS = ["á", "é", "í", "ó", "ú", "ñ", "ü"];

// A missed question comes back after this many others.
const RETRY_GAP = 3;

function Feedback({ result, card }: { result: Grade; card: Card }) {
  const styles = {
    correct: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    accent: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
    wrong: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  };
  return (
    <div role="status" className={`rounded-lg border px-4 py-3 ${styles[result]}`}>
      {result === "correct" && <p className="font-medium">Correct!</p>}
      {result === "accent" && (
        <p>
          <span className="font-medium">Right letters, mind the accent:</span>{" "}
          <span lang="es" className="font-semibold">
            {card.shown}
          </span>
        </p>
      )}
      {result === "wrong" && (
        <p>
          <span className="font-medium">The answer is</span> <span className="font-semibold">{card.shown}</span>. This one
          will come back.
        </p>
      )}
      {card.explain && <p className="mt-1">{card.explain}</p>}
      {card.link && (
        <Link href={card.link.href} className="mt-1 inline-block text-sm underline">
          {card.link.label}
        </Link>
      )}
    </div>
  );
}

export default function DrillRunner({
  first,
  next,
  onStop,
}: {
  first: Card;
  next: () => Card | null;
  onStop: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const [card, setCard] = useState(first);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Grade | null>(null);
  const [right, setRight] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [retries, setRetries] = useState<{ card: Card; dueAt: number }[]>([]);
  const [finished, setFinished] = useState(false);

  // Keeps the keyboard flow going: type, Enter to check, Enter for the next one.
  useEffect(() => {
    if (result) nextRef.current?.focus();
    else inputRef.current?.focus();
  }, [card, result]);

  function submit(value: string) {
    if (result || !value.trim()) return;
    const g = gradeCard(card, value);
    const good = g === "correct";
    setInput(value);
    setResult(g);
    setTotal(total + 1);
    if (good) setRight(right + 1);
    setStreak(good ? streak + 1 : 0);
    if (!good) setRetries([...retries, { card, dueAt: total + 1 + RETRY_GAP }]);
  }

  function advance() {
    const due = retries.find((r) => r.dueAt <= total);
    const fresh = due ? null : next();
    // A deck that runs out still finishes its missed questions before ending.
    const retry = due ?? (fresh ? undefined : retries[0]);
    if (retry) setRetries(retries.filter((r) => r !== retry));
    const following = retry?.card ?? fresh;
    if (!following) {
      setFinished(true);
      return;
    }
    setCard(following);
    setInput("");
    setResult(null);
  }

  function insertLetter(letter: string) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? input.length;
    const end = el?.selectionEnd ?? input.length;
    setInput(input.slice(0, start) + letter + input.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + 1, start + 1);
    });
  }

  if (finished) {
    return (
      <section className="mx-auto max-w-xl space-y-4 rounded-xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-2xl font-semibold tracking-tight">Finished!</h2>
        <p className="text-lg">
          {right} of {total} answers correct
        </p>
        <p className="text-sm text-zinc-500">Questions you missed came back, so the total can be higher than the quiz.</p>
        <button
          type="button"
          onClick={onStop}
          className="h-11 rounded-xl bg-emerald-700 px-6 font-medium text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          Done
        </button>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>
          {right} of {total} correct · streak {streak}
        </span>
        <button type="button" onClick={onStop} className="underline">
          Change settings
        </button>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">{card.context}</p>
        <h2 lang={card.titleIsSpanish ? "es" : "en"} className="mt-3 text-2xl font-semibold tracking-tight">
          {card.title}
        </h2>
        {card.subtitle && <p className="text-zinc-600 dark:text-zinc-400">{card.subtitle}</p>}
        <p className="mt-4 text-lg font-medium">{card.ask}</p>

        {card.choices ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {card.choices.map((choice) => (
              <button
                key={choice}
                type="button"
                disabled={!!result}
                onClick={() => submit(choice)}
                className={`min-h-12 rounded-xl border px-3 py-2 text-lg font-medium transition hover:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 ${
                  input === choice ? "border-emerald-600" : "border-zinc-300"
                }`}
              >
                {choice}
              </button>
            ))}
          </div>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
          >
            <label htmlFor="drill-answer" className="sr-only">
              Your answer
            </label>
            <input
              id="drill-answer"
              ref={inputRef}
              lang={card.english ? "en" : "es"}
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={input}
              readOnly={!!result}
              onChange={(e) => setInput(e.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-lg outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 dark:border-zinc-700 dark:bg-zinc-950"
            />
            {!card.english && (
              <div className="flex flex-wrap gap-1.5">
                {SPECIAL_LETTERS.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    disabled={!!result}
                    onClick={() => insertLetter(letter)}
                    aria-label={`Insert ${letter}`}
                    className="size-9 rounded-lg border border-zinc-200 font-medium transition hover:border-emerald-600 disabled:opacity-40 dark:border-zinc-700"
                  >
                    {letter}
                  </button>
                ))}
              </div>
            )}
            {!result && (
              <button
                type="submit"
                disabled={!input.trim()}
                className="h-11 w-full rounded-xl bg-emerald-700 font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Check
              </button>
            )}
          </form>
        )}

        {result && (
          <div className="mt-4 space-y-3">
            <Feedback result={result} card={card} />
            <button
              ref={nextRef}
              type="button"
              onClick={advance}
              className="h-11 w-full rounded-xl bg-emerald-700 font-medium text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

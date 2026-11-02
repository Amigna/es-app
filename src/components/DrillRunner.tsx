"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ReportProblem from "@/components/ReportProblem";
import SpeakButton from "@/components/SpeakButton";
import { gradeCard, type Card, type Grade } from "@/lib/drill";
import { recordAnswer, saveProgress } from "@/lib/progress-queue";

const SPECIAL_LETTERS = ["á", "é", "í", "ó", "ú", "ñ", "ü"];

// A missed question comes back after this many others.
const RETRY_GAP = 3;

function Feedback({ result, card, speak }: { result: Grade; card: Card; speak?: string }) {
  const styles = {
    correct: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    accent: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
    wrong: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  };
  return (
    <div role="status" className={`rounded-lg border px-4 py-3 ${styles[result]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
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
        </div>
        {speak && <SpeakButton text={speak} />}
      </div>
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
  const showRef = useRef<HTMLButtonElement>(null);
  const knewRef = useRef<HTMLButtonElement>(null);

  const [card, setCard] = useState(first);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Grade | null>(null);
  const [right, setRight] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [retries, setRetries] = useState<{ card: Card; dueAt: number }[]>([]);
  const [finished, setFinished] = useState(false);
  const [isRetry, setIsRetry] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isVocab = !!card.track?.item.startsWith("vocab:");
  const canGiveUp = isVocab || !!card.writing;

  // Keeps the keyboard flow going: type, Enter to check, Enter for the next one.
  useEffect(() => {
    if (card.flashcard) (revealed ? knewRef : showRef).current?.focus();
    // Stays put while comparing a translation, so a second Enter can't count it before it's been read.
    else if (revealed) return;
    else if (result) nextRef.current?.focus();
    else inputRef.current?.focus();
  }, [card, result, revealed]);

  // Save what's left when the session ends.
  useEffect(() => () => void saveProgress(), []);

  /** Returns the new counts, for a flashcard that moves straight on before state updates. */
  function record(g: Grade) {
    const good = g === "correct";
    const answeredNow = total + 1;
    const missed = good ? retries : [...retries, { card, dueAt: answeredNow + RETRY_GAP }];
    setResult(g);
    setTotal(answeredNow);
    // Only the first try counts, so a retry can't inflate progress.
    if (card.track && !isRetry) recordAnswer(card.track, g);
    if (good) setRight(right + 1);
    setStreak(good ? streak + 1 : 0);
    setRetries(missed);
    return { answeredNow, missed };
  }

  function submit(value: string) {
    if (result || revealed || !value.trim()) return;
    const g = gradeCard(card, value);
    setInput(value);
    // A translation that doesn't match may still be right, so the learner decides.
    if (card.writing && g === "wrong") setRevealed(true);
    else record(g);
  }

  function selfGrade(knew: boolean) {
    const { answeredNow, missed } = record(knew ? "correct" : "wrong");
    advance(answeredNow, missed);
  }

  function advance(done = total, waiting = retries) {
    const due = waiting.find((r) => r.dueAt <= done);
    const fresh = due ? null : next();
    // A deck that runs out still finishes its missed questions before ending.
    const retry = due ?? (fresh ? undefined : waiting[0]);
    if (retry) setRetries(waiting.filter((r) => r !== retry));
    const following = retry?.card ?? fresh;
    if (!following) {
      setFinished(true);
      saveProgress();
      return;
    }
    setIsRetry(!!retry);
    setCard(following);
    setInput("");
    setResult(null);
    setRevealed(false);
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
        {right < total && (
          <p className="text-sm text-zinc-500">Questions you missed came back, so they count more than once.</p>
        )}
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
        <button type="button" onClick={onStop} className="min-h-10 underline">
          Change settings
        </button>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {card.badge ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500">
            <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-lg font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              {card.badge}
            </span>
            {card.context}
          </p>
        ) : (
          <p className="text-sm text-zinc-500">{card.context}</p>
        )}
        <div className="mt-3 flex items-start justify-between gap-2">
          <h2 lang={card.titleIsSpanish ? "es" : "en"} className="text-2xl font-semibold tracking-tight">
            {card.title}
          </h2>
          {/* Only Spanish that's already on screen: speaking the answer early would give it away. */}
          {canGiveUp && card.titleIsSpanish && <SpeakButton text={card.title} />}
        </div>
        {card.subtitle && <p className="text-zinc-600 dark:text-zinc-400">{card.subtitle}</p>}
        {card.example && (
          <p className="mt-3 border-l-2 border-zinc-300 pl-3 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            <span lang="es" className="block font-medium text-zinc-800 dark:text-zinc-200">
              {card.example.es}
            </span>
            {card.example.en}
          </p>
        )}
        <p className="mt-4 text-lg font-medium">{card.ask}</p>

        {card.flashcard ? (
          <div className="mt-4 space-y-3">
            {revealed ? (
              <>
                <div role="status" className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-700">
                  <p className="flex items-center justify-between gap-2">
                    <span lang={card.english ? "en" : "es"} className="text-xl font-semibold">
                      {card.shown}
                    </span>
                    {!card.english && <SpeakButton text={card.shown} />}
                  </p>
                  {card.flashcard.note && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{card.flashcard.note}</p>}
                  {card.flashcard.example && (
                    <p className="mt-3 border-l-2 border-zinc-300 pl-3 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                      <span lang="es" className="block font-medium text-zinc-800 dark:text-zinc-200">
                        {card.flashcard.example.es}
                      </span>
                      {card.flashcard.example.en}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => selfGrade(false)}
                    className="h-11 rounded-xl border border-zinc-300 font-medium transition hover:border-emerald-600 dark:border-zinc-700"
                  >
                    Didn&apos;t know
                  </button>
                  <button
                    ref={knewRef}
                    type="button"
                    onClick={() => selfGrade(true)}
                    className="h-11 rounded-xl bg-emerald-700 font-medium text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                  >
                    Knew it
                  </button>
                </div>
                <ReportProblem key={card.id} about={[card.badge, card.title, card.shown].filter(Boolean).join(": ")} />
              </>
            ) : (
              <button
                ref={showRef}
                type="button"
                onClick={() => setRevealed(true)}
                className="h-11 w-full rounded-xl bg-emerald-700 font-medium text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              >
                Show answer
              </button>
            )}
          </div>
        ) : card.choices ? (
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
              readOnly={!!result || revealed}
              onChange={(e) => setInput(e.target.value)}
              className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-lg outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 dark:border-zinc-700 dark:bg-zinc-950"
            />
            {!card.english && (
              <div className="grid grid-cols-7 gap-1.5">
                {SPECIAL_LETTERS.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    disabled={!!result || revealed}
                    onClick={() => insertLetter(letter)}
                    aria-label={`Insert ${letter}`}
                    className="h-11 rounded-lg border border-zinc-200 font-medium transition hover:border-emerald-600 disabled:opacity-40 dark:border-zinc-700"
                  >
                    {letter}
                  </button>
                ))}
              </div>
            )}
            {!result && !revealed && (
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

        {card.writing && revealed && (
          <div className="mt-4 space-y-3">
            <div role="status" className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <p className="text-sm text-zinc-500">One good answer</p>
              <p className="flex items-start justify-between gap-2">
                <span lang={card.english ? "en" : "es"} className="text-lg font-semibold">
                  {card.shown}
                </span>
                {!card.english && <SpeakButton text={card.shown} />}
              </p>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Yours doesn&apos;t match exactly, but it can still be right. Count it if it means the same thing.</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => selfGrade(false)}
                className="h-11 rounded-xl border border-zinc-300 font-medium transition hover:border-emerald-600 dark:border-zinc-700"
              >
                Missed it
              </button>
              <button
                type="button"
                onClick={() => selfGrade(true)}
                className="h-11 rounded-xl bg-emerald-700 font-medium text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              >
                Mine works
              </button>
            </div>
            <ReportProblem key={card.id} about={[card.badge, card.title, card.shown].filter(Boolean).join(": ")} />
          </div>
        )}

        {!result && !revealed && !card.flashcard && canGiveUp && (
          <button type="button" onClick={() => record("wrong")} className="mt-3 min-h-10 w-full text-sm text-zinc-600 underline dark:text-zinc-400">
            I don&apos;t know this
          </button>
        )}

        {result && (
          <div className="mt-4 space-y-3">
            <Feedback result={result} card={card} speak={canGiveUp && !card.english ? card.shown : undefined} />
            <button
              ref={nextRef}
              type="button"
              onClick={() => advance()}
              className="h-11 w-full rounded-xl bg-emerald-700 font-medium text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Next
            </button>
            <ReportProblem key={card.id} about={[card.badge, card.title, card.shown].filter(Boolean).join(": ")} />
          </div>
        )}
      </section>
    </div>
  );
}

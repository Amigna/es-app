"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { TenseCard, moodHue } from "@/components/ConjugationView";
import { RuleCard } from "@/components/GuideSections";
import ReportProblem from "@/components/ReportProblem";
import SpeakButton from "@/components/SpeakButton";
import { conjugate } from "@/lib/conjugation/engine";
import { markVerb } from "@/lib/conjugation/regular";
import { TENSES } from "@/lib/conjugation/types";
import { accentTrap, gradeCard, wordDiff, type Card, type Grade, type TenseTable } from "@/lib/drill";
import { drillStreak, recordAnswer, recordStreak, saveProgress, syncDrillStreak } from "@/lib/progress-queue";
import { SLOW_RATE, speak } from "@/lib/speech";

const SPECIAL_LETTERS = ["á", "é", "í", "ó", "ú", "ñ", "ü"];

// A missed question comes back after this many others.
const RETRY_GAP = 3;

/** The sentence with each word marked by whether it was caught. */
function DictationAnswer({ input, card }: { input: string; card: Card }) {
  const marks = {
    ok: "",
    accent: "underline decoration-amber-500 decoration-2 underline-offset-4",
    missed: "font-bold underline decoration-red-500 decoration-wavy decoration-2 underline-offset-4",
  };
  return (
    <p lang="es" className="mt-1 text-lg">
      {wordDiff(input, card.shown).map((w, i) => (
        <span key={i}>
          {i > 0 && " "}
          <span className={marks[w.mark]}>{w.word}</span>
        </span>
      ))}
    </p>
  );
}

function Feedback({ result, card, input, speak, retry }: { result: Grade; card: Card; input: string; speak?: string; retry: boolean }) {
  const comesBack = retry ? " This one will come back." : "";
  const styles = {
    correct: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    accent: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
    wrong: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  };
  // Only on a miss: an accent that turns the answer into another real word is why it's wrong.
  const trap = result === "wrong" ? accentTrap(card, input) : null;
  const trapNote = trap && (
    <p className="mt-1">
      <span lang="es" className="font-semibold">
        {trap}
      </span>{" "}
      is a different word, so here the accent changes the meaning.
    </p>
  );
  return (
    <div role="status" className={`rounded-lg border px-4 py-3 ${styles[result]} ${result === "wrong" ? "animate-shake" : "animate-pop-in"}`}>
      <div className="flex items-start justify-between gap-2">
        {card.dictation ? (
          <div>
            <p className="font-medium">
              {result === "correct"
                ? "Correct!"
                : result === "accent"
                  ? "Right words, mind the accents underlined. This doesn't count against you."
                  : `Not quite. Words you missed are underlined.${comesBack}`}
            </p>
            <DictationAnswer input={input} card={card} />
            <p className="mt-1 opacity-80">{card.dictation.en}</p>
            {trapNote}
          </div>
        ) : (
          <div>
            {result === "correct" && <p className="font-medium">Correct!</p>}
            {result === "accent" && (
              <p>
                <span className="font-medium">Right letters, mind the accent:</span>{" "}
                <span lang="es" className="font-semibold">
                  {card.shown}
                </span>
                . This doesn&apos;t count against you.
              </p>
            )}
            {result === "wrong" && (
              <p>
                <span className="font-medium">The answer is</span> <span className="font-semibold">{card.shown}</span>.{comesBack}
              </p>
            )}
            {trapNote}
          </div>
        )}
        {speak && <SpeakButton text={speak} />}
      </div>
      {card.explain && <p className="mt-1">{card.explain}</p>}
    </div>
  );
}

/** The missed tense in full, as the verb page shows it. Nothing in it links away, so a stray tap can't end the drill. */
function MissedTense({ table }: { table: TenseTable }) {
  const { verb, tense, person, sentence } = table;
  const meta = TENSES.find((t) => t.id === tense)!;
  const conjugation = conjugate(verb);
  const forms = conjugation.tenses[tense];
  if (!forms) return null;
  return (
    <div style={moodHue(meta.mood)} className="animate-pop-in">
      <TenseCard
        infinitive={conjugation.infinitive}
        meta={meta}
        forms={forms}
        marks={markVerb(verb, conjugation)[tense]}
        voseo={false}
        sentence={sentence}
        highlight={person}
        report={false}
      />
    </div>
  );
}

/** Warms from marigold to red as the streak grows. */
function StreakChip({ streak }: { streak: number }) {
  const hue = Math.max(25, 85 - streak * 6);
  return (
    <span
      key={streak}
      style={{ "--hue": hue } as CSSProperties}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium tabular-nums ${
        streak === 0 ? "bg-stone-100 text-stone-500 dark:bg-stone-800" : "animate-bump bg-accent-100 text-accent-800 dark:bg-accent-950 dark:text-accent-200"
      }`}
    >
      Streak {streak}
    </span>
  );
}

// Spread out by index rather than at random, so every render places them the same way.
const CONFETTI = Array.from({ length: 48 }, (_, i) => ({
  "--x": `${(i * 37) % 100}%`,
  "--drift": `${((i * 53) % 21) - 10}vw`,
  "--delay": `${((i * 29) % 12) / 10}s`,
  "--spin": `${((i * 71) % 4) * 180 + 180}deg`,
  "--hue": [180, 35, 75, 135, 235, 350, 300, 270, 205, 325][i % 10],
})) as CSSProperties[];

function Confetti() {
  return (
    <div aria-hidden className="confetti">
      {CONFETTI.map((style, i) => (
        <span key={i} style={style} />
      ))}
    </div>
  );
}

export default function DrillRunner({
  first,
  next,
  onStop,
  onFinish,
  retry = true,
  stopLabel = "Change settings",
}: {
  first: Card;
  next: () => Card | null;
  onStop: () => void;
  /** Called once when the last card is answered, with the score as the results screen shows it. */
  onFinish?: (score: number) => void;
  /** Off for a test, where a miss shouldn't come back and the score is a first try. */
  retry?: boolean;
  stopLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const showRef = useRef<HTMLButtonElement>(null);
  const knewRef = useRef<HTMLButtonElement>(null);

  const [card, setCard] = useState(first);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Grade | null>(null);
  const [right, setRight] = useState(0);
  const [slips, setSlips] = useState(0);
  const [total, setTotal] = useState(0);
  // Drills that save progress carry on today's streak from the last one, on any device.
  const [streak, setStreak] = useState(() => (first.track ? drillStreak() : 0));
  const [bestStreak, setBestStreak] = useState(0);
  const answeredRef = useRef(false);
  const [retries, setRetries] = useState<{ card: Card; dueAt: number }[]>([]);
  const [finished, setFinished] = useState(false);
  const [isRetry, setIsRetry] = useState(false);
  const [revealed, setRevealed] = useState(false);
  // Counts cards shown, so a card that comes straight back still plays its sentence again.
  const [turn, setTurn] = useState(0);
  const isVocab = !!card.track?.item.startsWith("vocab:");
  const canGiveUp = isVocab || !!card.writing;
  const tenseMood = TENSES.find((t) => t.id === card.track?.tense)?.mood;
  // The whole sentence replaces the blanked one only once the card is answered, so hearing it can't give the answer away.
  const answeredSentence = result ? card.sentence : undefined;
  const exampleSentence = card.example ? answeredSentence : undefined;
  const titleSentence = card.example ? undefined : answeredSentence;

  // A dictation card starts by playing its sentence. Some phones only allow that after a first tap on Play.
  useEffect(() => {
    if (card.dictation) speak(card.answers[0]);
  }, [card, turn]);

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

  // A streak carried on another device arrives after the first render, and only replaces this one before any answer.
  useEffect(() => {
    if (!first.track) return;
    syncDrillStreak().then((carried) => {
      if (!answeredRef.current) setStreak(carried);
    });
    // Only when the session starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After the render that finished, so the counts include the last answer.
  useEffect(() => {
    if (!finished) return;
    const counted = total - slips;
    onFinish?.(counted ? Math.round((right / counted) * 100) : 100);
    // Only when the session ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  /** What gets saved about a miss. Dictation leaves the prompt out, since the sentence is the answer. */
  function mistake(given: string) {
    const prompt = card.dictation ? "" : [card.title, card.ask].filter(Boolean).join(" · ");
    return { label: card.badge ?? "", prompt, given: given.trim(), answer: card.shown };
  }

  /**
   * Returns the new counts, for a flashcard that moves straight on before state updates. `given` is what was typed,
   * and is left out for self-graded cards where nothing was. `selfGraded` is for the learner's own call, which leaves
   * the streak alone either way: it counts answers the app checked.
   */
  function record(g: Grade, given?: string, selfGraded = false) {
    // An accent slip shows the right spelling but doesn't come back or end the streak. It's counted on its own.
    const ok = g !== "wrong";
    const answeredNow = total + 1;
    const missed = ok || !retry ? retries : [...retries, { card, dueAt: answeredNow + RETRY_GAP }];
    setResult(g);
    setTotal(answeredNow);
    // Only the first try counts, so a retry can't inflate progress.
    if (card.track && !isRetry) recordAnswer(card.track, g, given === undefined ? undefined : mistake(given));
    if (g === "correct") setRight(right + 1);
    if (g === "accent") setSlips(slips + 1);
    answeredRef.current = true;
    if (!selfGraded) {
      const now = ok ? streak + 1 : 0;
      setStreak(now);
      if (ok) setBestStreak(Math.max(bestStreak, now));
      // Drills that save progress count toward the record, the same streak that's on screen.
      if (card.track && now !== streak) recordStreak(now);
    }
    setRetries(missed);
    return { answeredNow, missed };
  }

  function submit(value: string) {
    if (result || revealed || !value.trim()) return;
    const g = gradeCard(card, value);
    setInput(value);
    // A translation that doesn't match may still be right, so the learner decides.
    if (card.writing && g === "wrong") setRevealed(true);
    else record(g, value);
  }

  function selfGrade(knew: boolean) {
    const { answeredNow, missed } = record(knew ? "correct" : "wrong", card.writing ? input : undefined, true);
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
    setTurn(turn + 1);
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
    // Accent slips are left out of the score, the same way /progress counts accuracy.
    const counted = total - slips;
    const score = counted ? Math.round((right / counted) * 100) : 100;
    // The confetti sits outside the card: the card's pop-in transform would otherwise trap it inside.
    return (
      <>
        <Confetti />
        <section className="animate-pop-in mx-auto max-w-xl space-y-4 rounded-xl border border-t-4 border-stone-200 border-t-accent-500 bg-white p-6 text-center dark:border-stone-800 dark:bg-stone-900">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-accent-800 dark:text-accent-300">
            {score >= 80 ? "¡Excelente!" : score >= 50 ? "¡Bien hecho!" : "¡Sigue así!"}
          </h2>
          <p className="font-display text-5xl font-semibold tabular-nums text-accent-700 dark:text-accent-300">{score}%</p>
          <p className="text-lg">
            {right} of {counted} answers correct
          </p>
          {slips > 0 && (
            <p className="text-amber-800 dark:text-amber-300">
              {slips} accent {slips === 1 ? "slip" : "slips"}, not counted in the score
            </p>
          )}
          {bestStreak >= 3 && <p className="text-stone-600 dark:text-stone-400">Best streak: {bestStreak} in a row</p>}
          {right < counted && retry && (
            <p className="text-sm text-stone-500">Questions you missed came back, so they count more than once.</p>
          )}
          <button
            type="button"
            onClick={onStop}
            className="h-11 rounded-xl bg-accent-700 px-6 font-medium text-white transition hover:bg-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
          >
            Done
          </button>
        </section>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between text-sm text-stone-500">
        <span className="flex items-center gap-2">
          {right} of {total - slips} correct
          {slips > 0 && <span className="text-amber-800 dark:text-amber-300">· {slips} accent</span>}
          <StreakChip streak={streak} />
        </span>
        <button type="button" onClick={onStop} className="min-h-10 underline">
          {stopLabel}
        </button>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
        {card.badge ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-500">
            {/* A tense takes its mood's color, as on the verb pages, so a change of tense stands out from card to card. */}
            <span
              style={tenseMood ? moodHue(tenseMood) : undefined}
              className="rounded-md bg-accent-100 px-2.5 py-1 text-lg font-bold text-accent-900 dark:bg-accent-950 dark:text-accent-200"
            >
              {card.badge}
            </span>
            {card.context}
          </p>
        ) : (
          <p className="text-sm text-stone-500">{card.context}</p>
        )}
        <div className="mt-3 flex items-start justify-between gap-2">
          <h2 lang={card.titleIsSpanish ? "es" : "en"} className="text-2xl font-semibold tracking-tight">
            {titleSentence ?? card.title}
          </h2>
          {/* Only Spanish that's already on screen: speaking the answer early would give it away. */}
          {titleSentence ? <SpeakButton text={titleSentence} /> : canGiveUp && card.titleIsSpanish && <SpeakButton text={card.title} />}
        </div>
        {card.subtitle && <p className="text-stone-600 dark:text-stone-400">{card.subtitle}</p>}
        {card.dictation && (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => speak(card.answers[0])}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-accent-600 px-5 font-medium text-accent-800 transition hover:bg-accent-50 dark:text-accent-300 dark:hover:bg-accent-950"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-4">
                <path d="M7 4v16l13-8z" />
              </svg>
              Play
            </button>
            <button
              type="button"
              onClick={() => speak(card.answers[0], SLOW_RATE)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-stone-300 px-5 font-medium transition hover:border-accent-600 dark:border-stone-700"
            >
              Slower
            </button>
          </div>
        )}
        {card.example && (
          <div className="mt-3 flex items-start justify-between gap-2 border-l-2 border-stone-300 pl-3 text-stone-600 dark:border-stone-700 dark:text-stone-400">
            <p>
              <span lang="es" className="block font-medium text-stone-800 dark:text-stone-200">
                {exampleSentence ?? card.example.es}
              </span>
              {card.example.en}
            </p>
            {exampleSentence && <SpeakButton text={exampleSentence} />}
          </div>
        )}
        <p className="mt-4 text-lg font-medium">{card.ask}</p>

        {card.flashcard ? (
          <div className="mt-4 space-y-3">
            {revealed ? (
              <>
                <div role="status" className="rounded-lg border border-stone-200 px-4 py-3 dark:border-stone-700">
                  <p className="flex items-center justify-between gap-2">
                    <span lang={card.english ? "en" : "es"} className="text-xl font-semibold">
                      {card.shown}
                    </span>
                    {!card.english && <SpeakButton text={card.shown} />}
                  </p>
                  {card.flashcard.note && <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{card.flashcard.note}</p>}
                  {card.flashcard.example && (
                    <div className="mt-3 flex items-start justify-between gap-2 border-l-2 border-stone-300 pl-3 text-stone-600 dark:border-stone-700 dark:text-stone-400">
                      <p>
                        <span lang="es" className="block font-medium text-stone-800 dark:text-stone-200">
                          {card.flashcard.example.es}
                        </span>
                        {card.flashcard.example.en}
                      </p>
                      <SpeakButton text={card.flashcard.example.es} />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => selfGrade(false)}
                    className="h-11 rounded-xl border border-stone-300 font-medium transition hover:border-accent-600 dark:border-stone-700"
                  >
                    Didn&apos;t know
                  </button>
                  <button
                    ref={knewRef}
                    type="button"
                    onClick={() => selfGrade(true)}
                    className="h-11 rounded-xl bg-accent-700 font-medium text-white transition hover:bg-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
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
                className="h-11 w-full rounded-xl bg-accent-700 font-medium text-white transition hover:bg-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
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
                className={`min-h-12 rounded-xl border px-3 py-2 text-lg font-medium transition hover:border-accent-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-stone-700 ${
                  input === choice ? "border-accent-600" : "border-stone-300"
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
              className="h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-lg outline-none transition focus:border-accent-600 focus:ring-2 focus:ring-accent-600/30 dark:border-stone-700 dark:bg-stone-950"
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
                    className="h-11 rounded-lg border border-stone-200 font-medium transition hover:border-accent-600 disabled:opacity-40 dark:border-stone-700"
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
                className="h-11 w-full rounded-xl bg-accent-700 font-medium text-white transition hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Check
              </button>
            )}
          </form>
        )}

        {card.writing && revealed && (
          <div className="mt-4 space-y-3">
            <div role="status" className="rounded-lg border border-stone-200 px-4 py-3 dark:border-stone-700">
              <p className="text-sm text-stone-500">One good answer</p>
              {card.english ? (
                <p lang="en" className="text-lg font-semibold">
                  {card.shown}
                </p>
              ) : (
                // In Spanish the difference is often one word or an accent, so the words that differ are underlined.
                <div className="flex items-start justify-between gap-2 font-semibold">
                  <DictationAnswer input={input} card={card} />
                  <SpeakButton text={card.shown} />
                </div>
              )}
              {!card.english && accentTrap(card, input) && (
                <p className="mt-1 text-sm">
                  <span lang="es" className="font-semibold">
                    {accentTrap(card, input)}
                  </span>{" "}
                  is a different word, so here the accent changes the meaning.
                </p>
              )}
            </div>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Yours doesn&apos;t match exactly{card.english ? "" : ". Words that differ from this answer are underlined"}, but it can still be right. Count it if it
              means the same thing.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => selfGrade(false)}
                className="h-11 rounded-xl border border-stone-300 font-medium transition hover:border-accent-600 dark:border-stone-700"
              >
                Missed it
              </button>
              <button
                type="button"
                onClick={() => selfGrade(true)}
                className="h-11 rounded-xl bg-accent-700 font-medium text-white transition hover:bg-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
              >
                Mine works
              </button>
            </div>
            <ReportProblem key={card.id} about={[card.badge, card.title, card.shown].filter(Boolean).join(": ")} />
          </div>
        )}

        {!result && !revealed && !card.flashcard && canGiveUp && (
          <button type="button" onClick={() => record("wrong", "")} className="mt-3 min-h-10 w-full text-sm text-stone-600 underline dark:text-stone-400">
            I don&apos;t know this
          </button>
        )}

        {result && (
          <div className="mt-4 space-y-3">
            <Feedback result={result} card={card} input={input} retry={retry} speak={(canGiveUp || card.dictation) && !card.english ? card.shown : undefined} />
            <button
              ref={nextRef}
              type="button"
              onClick={() => advance()}
              className="h-11 w-full rounded-xl bg-accent-700 font-medium text-white transition hover:bg-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            >
              Next
            </button>
            <ReportProblem key={card.id} about={[card.badge, card.title, card.shown].filter(Boolean).join(": ")} />
          </div>
        )}
      </section>

      {result === "wrong" && card.table && <MissedTense key={card.id} table={card.table} />}
      {result === "wrong" && card.lesson && (
        <div key={card.id} className="animate-pop-in">
          <RuleCard rule={card.lesson} />
        </div>
      )}
    </div>
  );
}

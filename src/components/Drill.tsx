"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { TENSES, type Mood, type TenseId } from "@/lib/conjugation/types";
import { grade, makeQuestion, poolVerbs, type Grade, type Question, type VerbPool } from "@/lib/drill";
import { VERBS, verbSlug } from "@/lib/verbs";

const MOODS: { id: Mood; title: string }[] = [
  { id: "indicative", title: "Indicative" },
  { id: "subjunctive", title: "Subjunctive" },
  { id: "imperative", title: "Imperative" },
];

const POOLS: { id: VerbPool; title: string; hint: string }[] = [
  { id: "common", title: "Most common", hint: "The top 50 verbs" },
  { id: "irregular", title: "Irregular", hint: "Irregular and stem-changing" },
  { id: "all", title: "All verbs", hint: `All ${VERBS.length} verbs` },
];

const SPECIAL_LETTERS = ["á", "é", "í", "ó", "ú", "ñ", "ü"];

// A missed question comes back after this many others.
const RETRY_GAP = 3;

const tenseMeta = (id: TenseId) => TENSES.find((t) => t.id === id)!;

interface Stats {
  right: number;
  total: number;
  streak: number;
}

function Setup({
  tenses,
  pool,
  onToggle,
  onPool,
  onStart,
}: {
  tenses: Set<TenseId>;
  pool: VerbPool;
  onToggle: (id: TenseId) => void;
  onPool: (pool: VerbPool) => void;
  onStart: () => void;
}) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-xl font-semibold">Which verbs?</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {POOLS.map((p) => (
            <label
              key={p.id}
              className={`cursor-pointer rounded-lg border px-3 py-2 transition ${
                pool === p.id ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950" : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <input type="radio" name="pool" checked={pool === p.id} onChange={() => onPool(p.id)} className="sr-only" />
              <span className="block font-medium">{p.title}</span>
              <span className="block text-sm text-zinc-500">{p.hint}</span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Which tenses?</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {MOODS.map((mood) => (
            <fieldset key={mood.id}>
              <legend className="mb-2 font-medium">{mood.title}</legend>
              <div className="space-y-1.5">
                {TENSES.filter((t) => t.mood === mood.id).map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={tenses.has(t.id)}
                      onChange={() => onToggle(t.id)}
                      className="size-4 accent-emerald-700"
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={onStart}
        disabled={tenses.size === 0}
        className="h-12 rounded-xl bg-emerald-700 px-6 font-medium text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Start drilling
      </button>
    </div>
  );
}

function Feedback({ result, question }: { result: Grade; question: Question }) {
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
            {question.answer}
          </span>
        </p>
      )}
      {result === "wrong" && (
        <p>
          <span className="font-medium">The answer is</span>{" "}
          <span lang="es" className="font-semibold">
            {question.answer}
          </span>
          . This one will come back.
        </p>
      )}
      <Link href={`/verb/${verbSlug(question.verb.inf)}`} className="mt-1 inline-block text-sm underline">
        See all forms of {question.verb.inf}
      </Link>
    </div>
  );
}

export default function Drill({ rare }: { rare: string[] }) {
  const rareSet = useMemo(() => new Set(rare), [rare]);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const [tenses, setTenses] = useState<Set<TenseId>>(new Set<TenseId>(["present", "preterite", "imperfect"]));
  const [pool, setPool] = useState<VerbPool>("common");
  const [question, setQuestion] = useState<Question | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Grade | null>(null);
  const [stats, setStats] = useState<Stats>({ right: 0, total: 0, streak: 0 });
  const [retries, setRetries] = useState<{ question: Question; dueAt: number }[]>([]);
  const [empty, setEmpty] = useState(false);

  // Keeps the keyboard flow going: type, Enter to check, Enter for the next one.
  useEffect(() => {
    if (!question) return;
    if (result) nextRef.current?.focus();
    else inputRef.current?.focus();
  }, [question, result]);

  function pick(total: number): Question | null {
    const due = retries.find((r) => r.dueAt <= total);
    if (due) {
      setRetries(retries.filter((r) => r !== due));
      return due.question;
    }
    return makeQuestion(poolVerbs(VERBS, pool), [...tenses], rareSet);
  }

  function ask(total: number) {
    const next = pick(total);
    setQuestion(next);
    setEmpty(!next);
    setInput("");
    setResult(null);
  }

  function check() {
    if (!question || !input.trim()) return;
    const g = grade(input, question.answer);
    const good = g === "correct";
    setResult(g);
    setStats((s) => ({
      right: s.right + (good ? 1 : 0),
      total: s.total + 1,
      streak: good ? s.streak + 1 : 0,
    }));
    if (!good) setRetries((r) => [...r, { question, dueAt: stats.total + 1 + RETRY_GAP }]);
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

  function stop() {
    setQuestion(null);
    setResult(null);
    setInput("");
    setRetries([]);
    setStats({ right: 0, total: 0, streak: 0 });
    setEmpty(false);
  }

  if (!question) {
    return (
      <div className="space-y-4">
        {empty && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            No questions match that choice. Try adding more tenses or verbs.
          </p>
        )}
        <Setup
          tenses={tenses}
          pool={pool}
          onToggle={(id) => {
            const next = new Set(tenses);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            setTenses(next);
          }}
          onPool={setPool}
          onStart={() => ask(0)}
        />
      </div>
    );
  }

  const meta = tenseMeta(question.tense);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>
          {stats.right} of {stats.total} correct · streak {stats.streak}
        </span>
        <button type="button" onClick={stop} className="underline">
          Change settings
        </button>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">
          {meta.name} · {meta.hint}
        </p>
        <h2 lang="es" className="mt-3 text-3xl font-semibold tracking-tight">
          {question.verb.inf}
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400">{question.verb.en}</p>
        <p className="mt-4 text-lg">
          <span className="text-zinc-500">Form for</span> <span className="font-semibold">{question.label}</span>
        </p>

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
        >
          <label htmlFor="drill-answer" className="sr-only">
            Your answer
          </label>
          <input
            id="drill-answer"
            ref={inputRef}
            lang="es"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={input}
            readOnly={!!result}
            onChange={(e) => setInput(e.target.value)}
            className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-lg outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 dark:border-zinc-700 dark:bg-zinc-950"
          />
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

        {result && (
          <div className="mt-4 space-y-3">
            <Feedback result={result} question={question} />
            <button
              ref={nextRef}
              type="button"
              onClick={() => ask(stats.total)}
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

"use client";

import { useMemo, useState, type CSSProperties } from "react";
import ReportProblem from "@/components/ReportProblem";
import SpeakButton from "@/components/SpeakButton";
import { stripAccents } from "@/lib/conjugation/accent";

export interface WordRow {
  id: string;
  /** Headword as displayed, e.g. "la casa". */
  word: string;
  /** For nouns: colors the article as a reminder of the gender. */
  gender?: "m" | "f";
  /** Other forms, e.g. the plural. */
  forms?: string;
  en: string;
  topic?: string;
  note?: string;
  example?: { es: string; en: string };
}

const norm = (s: string) => stripAccents(s.toLowerCase());

// Feminine words can take el (el agua), so the color follows the gender, not the article.
const GENDER = {
  m: { hue: 270, label: "masculine" },
  f: { hue: 35, label: "feminine" },
} as const;

function Headword({ word, gender }: { word: string; gender?: "m" | "f" }) {
  const space = word.indexOf(" ");
  if (!gender || space < 0) return word;
  return (
    <>
      <span
        style={{ "--hue": GENDER[gender].hue } as CSSProperties}
        title={GENDER[gender].label}
        className="text-accent-700 dark:text-accent-300"
      >
        {word.slice(0, space)}
      </span>
      {word.slice(space)}
    </>
  );
}

export default function WordList({ rows, placeholder }: { rows: WordRow[]; placeholder: string }) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | null>(null);

  const topics = useMemo(() => [...new Set(rows.flatMap((r) => (r.topic ? [r.topic] : [])))].sort(), [rows]);

  const q = norm(query.trim());
  const visible = rows.filter(
    (r) => (!topic || r.topic === topic) && (!q || norm(r.word).includes(q) || r.en.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-5">
      <input
        type="search"
        aria-label="Filter this list"
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-11 w-full rounded-xl border border-stone-300 bg-white px-4 outline-none transition focus:border-accent-600 focus:ring-2 focus:ring-accent-600/30 dark:border-stone-700 dark:bg-stone-900"
      />

      {topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[null, ...topics].map((t) => (
            <button
              key={t ?? "all"}
              type="button"
              aria-pressed={topic === t}
              onClick={() => setTopic(t)}
              className={`min-h-10 rounded-full border px-3 py-1 text-sm capitalize transition ${
                topic === t
                  ? "border-accent-700 bg-accent-700 text-white"
                  : "border-stone-200 hover:border-accent-600 dark:border-stone-700"
              }`}
            >
              {t ?? "all"}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-stone-500">
        <p aria-live="polite">
          {visible.length} of {rows.length}
        </p>
        {rows.some((r) => r.gender) && (
          <p className="flex gap-3">
            {Object.values(GENDER).map((g) => (
              <span key={g.label} style={{ "--hue": g.hue } as CSSProperties} className="font-medium text-accent-700 dark:text-accent-300">
                {g.label}
              </span>
            ))}
          </p>
        )}
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        {visible.map((r) => (
          <li key={r.id} className="flex flex-col rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
            <div className="flex items-start justify-between gap-2">
              <p lang="es" className="text-lg font-semibold">
                <Headword word={r.word} gender={r.gender} />
              </p>
              <SpeakButton text={r.word} />
            </div>
            {r.forms && (
              <p lang="es" className="text-sm text-stone-500">
                {r.forms}
              </p>
            )}
            <p className="text-stone-600 dark:text-stone-400">{r.en}</p>
            {r.note && <p className="mt-1 text-sm italic text-stone-500">{r.note}</p>}
            {r.example && (
              <div className="mt-3 border-t border-stone-100 pt-3 dark:border-stone-800">
                <div className="flex items-start justify-between gap-2">
                  <p lang="es">{r.example.es}</p>
                  <SpeakButton text={r.example.es} />
                </div>
                <p className="text-sm text-stone-500">{r.example.en}</p>
              </div>
            )}
            <ReportProblem about={`${r.word} (${r.en})`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

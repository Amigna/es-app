"use client";

import { useMemo, useState } from "react";
import ReportProblem from "@/components/ReportProblem";
import SpeakButton from "@/components/SpeakButton";
import { stripAccents } from "@/lib/conjugation/accent";

export interface WordRow {
  id: string;
  /** Headword as displayed, e.g. "la casa". */
  word: string;
  /** Other forms, e.g. the plural. */
  forms?: string;
  en: string;
  topic?: string;
  note?: string;
  example?: { es: string; en: string };
}

const norm = (s: string) => stripAccents(s.toLowerCase());

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
        className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 dark:border-zinc-700 dark:bg-zinc-900"
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
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-zinc-200 hover:border-emerald-600 dark:border-zinc-700"
              }`}
            >
              {t ?? "all"}
            </button>
          ))}
        </div>
      )}

      <p className="text-sm text-zinc-500" aria-live="polite">
        {visible.length} of {rows.length}
      </p>

      <ul className="grid gap-3 md:grid-cols-2">
        {visible.map((r) => (
          <li key={r.id} className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-2">
              <p lang="es" className="text-lg font-semibold">
                {r.word}
              </p>
              <SpeakButton text={r.word} />
            </div>
            {r.forms && (
              <p lang="es" className="text-sm text-zinc-500">
                {r.forms}
              </p>
            )}
            <p className="text-zinc-600 dark:text-zinc-400">{r.en}</p>
            {r.note && <p className="mt-1 text-sm italic text-zinc-500">{r.note}</p>}
            {r.example && (
              <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <div className="flex items-start justify-between gap-2">
                  <p lang="es">{r.example.es}</p>
                  <SpeakButton text={r.example.es} />
                </div>
                <p className="text-sm text-zinc-500">{r.example.en}</p>
              </div>
            )}
            <ReportProblem about={`${r.word} (${r.en})`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

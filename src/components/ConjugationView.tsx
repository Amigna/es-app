"use client";

import { useState, type CSSProperties } from "react";
import ReportProblem from "@/components/ReportProblem";
import SpeakButton from "@/components/SpeakButton";
import type { Change, FormMark, TenseMarks } from "@/lib/conjugation/regular";
import { TENSES, type Conjugation, type Mood, type TenseForms, type TenseId, type TenseMeta } from "@/lib/conjugation/types";
import { findForm, type RareTense, type Sentence, type VerbSentences } from "@/lib/sentences";

// Each mood has its own hue, so a table's color says which mood it's in.
const MOODS: { id: Mood; title: string; spanish: string; hue: number }[] = [
  { id: "indicative", title: "Indicative", spanish: "Indicativo", hue: 180 },
  { id: "subjunctive", title: "Subjunctive", spanish: "Subjuntivo", hue: 300 },
  { id: "imperative", title: "Imperative", spanish: "Imperativo", hue: 350 },
];

const hueStyle = (hue: number) => ({ "--hue": hue }) as CSSProperties;

// Fixed colors, apart from the mood hues, so they mean the same thing in every table.
const CHANGES: Record<Change, { label: string; example: string; cls: string }> = {
  stem: {
    label: "stem change",
    example: "pienso",
    cls: "-mx-1 rounded bg-sky-100 px-1 text-sky-950 dark:bg-sky-900/60 dark:text-sky-100",
  },
  irregular: {
    label: "irregular",
    example: "tengo",
    cls: "-mx-1 rounded bg-amber-100 px-1 text-amber-950 dark:bg-amber-900/60 dark:text-amber-100",
  },
  spelling: {
    label: "spelling change",
    example: "busqué",
    cls: "underline decoration-stone-400 decoration-dotted decoration-2 underline-offset-4 dark:decoration-stone-500",
  },
};

/** A form with its regular ending in the mood's color, or marked whole when it departs from the pattern. */
function Form({ form, mark }: { form: string; mark?: FormMark | null }) {
  if (!mark) return form;
  if ("change" in mark) return <span className={CHANGES[mark.change].cls}>{form}</span>;
  return (
    <>
      {form.slice(0, mark.ending)}
      <span className="text-accent-700 dark:text-accent-300">{form.slice(mark.ending)}</span>
    </>
  );
}

const PERSONS = ["yo", "tú", "él / ella / usted", "nosotros", "ellos / ellas / ustedes"];
const IMPERATIVE_PERSONS = [null, "tú", "usted", "nosotros", "ustedes"];

function rows(meta: TenseMeta, t: TenseForms, voseo: boolean, marks?: TenseMarks) {
  const labels = meta.mood === "imperative" ? IMPERATIVE_PERSONS : PERSONS;
  const out: { label: string; form: string; mark?: FormMark | null; vos?: boolean; person?: number }[] = [];
  t.forms.forEach((form, i) => {
    const label = labels[i];
    if (!form || !label) return;
    out.push({ label, form, mark: marks?.forms[i], person: i });
    if (i === 1 && voseo && t.vos) out.push({ label: "vos", form: t.vos, mark: marks?.vos, vos: true });
  });
  return out;
}

function Example({ sentence, form }: { sentence: Sentence; form: string }) {
  const hit = findForm(sentence.es, form);
  return (
    <div className="mt-3 flex items-start justify-between gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
      <div>
        <p lang="es">
          {hit ? (
            <>
              {sentence.es.slice(0, hit.start)}
              <strong className="font-semibold text-accent-800 dark:text-accent-300">
                {sentence.es.slice(hit.start, hit.end)}
              </strong>
              {sentence.es.slice(hit.end)}
            </>
          ) : (
            sentence.es
          )}
        </p>
        <p className="text-sm text-stone-500">{sentence.en}</p>
      </div>
      <SpeakButton text={sentence.es} />
    </div>
  );
}

/** The hue a tense's table is drawn in, from its mood. */
export const moodHue = (mood: Mood) => hueStyle(MOODS.find((m) => m.id === mood)!.hue);

/**
 * One tense's forms with an example. `highlight` marks a person's row, for showing what a drill asked. A drill turns
 * `report` off, since it has a report link of its own.
 */
export function TenseCard({
  infinitive,
  meta,
  forms,
  marks,
  voseo,
  sentence,
  highlight,
  report = true,
}: {
  infinitive: string;
  meta: TenseMeta;
  forms: TenseForms;
  marks?: TenseMarks;
  voseo: boolean;
  sentence?: Sentence | RareTense;
  highlight?: number;
  report?: boolean;
}) {
  const rare = !!sentence && "rare" in sentence;
  const example = sentence && !("rare" in sentence) ? sentence : null;
  const exampleForm = example ? forms.forms[example.person] : null;
  const list = rows(meta, forms, voseo, marks);
  if (list.length === 0) return null;
  return (
    <section className="flex flex-col rounded-xl border border-t-4 border-stone-200 border-t-accent-500 bg-white p-4 dark:border-stone-800 dark:border-t-accent-600 dark:bg-stone-900">
      <h3 className="font-semibold">{meta.name}</h3>
      <p className="text-sm text-stone-500">
        {meta.spanish} · {meta.hint}
      </p>
      <dl className="mt-3 divide-y divide-stone-100 dark:divide-stone-800">
        {list.map((r) => (
          <div
            key={r.label}
            className={`grid grid-cols-[6.5rem_1fr] gap-3 py-1.5 ${
              r.person === highlight ? "-mx-2 rounded-md bg-accent-50 px-2 dark:bg-accent-950" : ""
            }`}
          >
            <dt className={`text-sm ${r.vos ? "font-medium text-stone-700 dark:text-stone-300" : "text-stone-500"}`}>{r.label}</dt>
            <dd className="font-medium">
              <Form form={r.form} mark={r.mark} />
            </dd>
          </div>
        ))}
      </dl>
      {example && exampleForm && <Example sentence={example} form={exampleForm} />}
      {rare && (
        <p className="mt-3 border-t border-stone-100 pt-3 text-sm italic text-stone-500 dark:border-stone-800">
          Rarely used with this verb.
        </p>
      )}
      {report && <ReportProblem about={`${infinitive}, ${meta.name}${example ? `: ${example.es}` : ""}`} />}
    </section>
  );
}

export default function ConjugationView({
  conjugation,
  marks,
  sentences,
}: {
  conjugation: Conjugation;
  marks: Partial<Record<TenseId, TenseMarks>>;
  sentences: VerbSentences | null;
}) {
  const [voseo, setVoseo] = useState(false);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Gerund</dt>
            <dd className="text-lg font-medium">{conjugation.gerund}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Past participle</dt>
            <dd className="text-lg font-medium">{conjugation.participle}</dd>
          </div>
        </dl>
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={voseo}
            onChange={(e) => setVoseo(e.target.checked)}
            className="size-4 accent-accent-700"
          />
          <span>
            Show voseo (<span className="italic">vos</span>)
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {/* Verb pages are long on a phone, so jump straight to a mood. */}
        <nav aria-label="Jump to a mood" className="flex flex-wrap gap-2">
          {MOODS.map((mood) => (
            <a
              key={mood.id}
              href={`#${mood.id}`}
              style={hueStyle(mood.hue)}
              className="flex min-h-10 items-center gap-2 rounded-full border border-accent-200 bg-accent-50 px-4 text-sm font-medium text-accent-800 transition hover:border-accent-500 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-200"
            >
              <span aria-hidden className="size-2.5 rounded-full bg-accent-500" />
              {mood.title}
            </a>
          ))}
        </nav>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600 dark:text-stone-400">
          <span>
            habl<span className="font-medium text-accent-700 dark:text-accent-300">amos</span> regular ending
          </span>
          {(["stem", "irregular", "spelling"] as const).map((c) => (
            <span key={c}>
              {/* The padding offsets the highlight's negative margin, so it doesn't crowd the label. */}
              <span className="px-1">
                <span className={`font-medium ${CHANGES[c].cls}`}>{CHANGES[c].example}</span>
              </span>{" "}
              {CHANGES[c].label}
            </span>
          ))}
        </p>
      </div>

      {MOODS.map((mood) => (
        <div key={mood.id} id={mood.id} style={hueStyle(mood.hue)} className="scroll-mt-4">
          <h2 className="mb-4 flex flex-wrap items-center gap-x-2 font-display text-2xl font-semibold text-accent-800 dark:text-accent-300">
            <span aria-hidden className="size-3 rounded-full bg-accent-500" />
            {mood.title} <span className="font-normal text-stone-500">· {mood.spanish}</span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TENSES.filter((t) => t.mood === mood.id).map((meta) => {
              const forms = conjugation.tenses[meta.id];
              return forms ? (
                <TenseCard
                  key={meta.id}
                  infinitive={conjugation.infinitive}
                  meta={meta}
                  forms={forms}
                  marks={marks[meta.id]}
                  voseo={voseo}
                  sentence={sentences?.[meta.id]}
                />
              ) : null;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

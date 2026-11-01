"use client";

import { useState } from "react";
import { TENSES, type Conjugation, type Mood, type TenseForms, type TenseMeta } from "@/lib/conjugation/types";
import { findForm, type RareTense, type Sentence, type VerbSentences } from "@/lib/sentences";

const MOODS: { id: Mood; title: string; spanish: string }[] = [
  { id: "indicative", title: "Indicative", spanish: "Indicativo" },
  { id: "subjunctive", title: "Subjunctive", spanish: "Subjuntivo" },
  { id: "imperative", title: "Imperative", spanish: "Imperativo" },
];

const PERSONS = ["yo", "tú", "él / ella / usted", "nosotros", "ellos / ellas / ustedes"];
const IMPERATIVE_PERSONS = [null, "tú", "usted", "nosotros", "ustedes"];

function rows(meta: TenseMeta, t: TenseForms, voseo: boolean) {
  const labels = meta.mood === "imperative" ? IMPERATIVE_PERSONS : PERSONS;
  const out: { label: string; form: string; vos?: boolean }[] = [];
  t.forms.forEach((form, i) => {
    const label = labels[i];
    if (!form || !label) return;
    out.push({ label, form });
    if (i === 1 && voseo && t.vos) out.push({ label: "vos", form: t.vos, vos: true });
  });
  return out;
}

function Example({ sentence, form }: { sentence: Sentence; form: string }) {
  const hit = findForm(sentence.es, form);
  return (
    <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      <p lang="es">
        {hit ? (
          <>
            {sentence.es.slice(0, hit.start)}
            <strong className="font-semibold text-emerald-800 dark:text-emerald-300">
              {sentence.es.slice(hit.start, hit.end)}
            </strong>
            {sentence.es.slice(hit.end)}
          </>
        ) : (
          sentence.es
        )}
      </p>
      <p className="text-sm text-zinc-500">{sentence.en}</p>
    </div>
  );
}

function TenseCard({
  meta,
  forms,
  voseo,
  sentence,
}: {
  meta: TenseMeta;
  forms: TenseForms;
  voseo: boolean;
  sentence?: Sentence | RareTense;
}) {
  const rare = !!sentence && "rare" in sentence;
  const example = sentence && !("rare" in sentence) ? sentence : null;
  const exampleForm = example ? forms.forms[example.person] : null;
  const list = rows(meta, forms, voseo);
  if (list.length === 0) return null;
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="font-semibold">{meta.name}</h3>
      <p className="text-sm text-zinc-500">
        {meta.spanish} · {meta.hint}
      </p>
      <dl className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
        {list.map((r) => (
          <div key={r.label} className="grid grid-cols-[6.5rem_1fr] gap-3 py-1.5">
            <dt className={`text-sm ${r.vos ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500"}`}>{r.label}</dt>
            <dd className={`font-medium ${r.vos ? "text-emerald-800 dark:text-emerald-300" : ""}`}>{r.form}</dd>
          </div>
        ))}
      </dl>
      {example && exampleForm && <Example sentence={example} form={exampleForm} />}
      {rare && (
        <p className="mt-3 border-t border-zinc-100 pt-3 text-sm italic text-zinc-500 dark:border-zinc-800">
          Rarely used with this verb.
        </p>
      )}
    </section>
  );
}

export default function ConjugationView({
  conjugation,
  sentences,
}: {
  conjugation: Conjugation;
  sentences: VerbSentences | null;
}) {
  const [voseo, setVoseo] = useState(false);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Gerund</dt>
            <dd className="text-lg font-medium">{conjugation.gerund}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Past participle</dt>
            <dd className="text-lg font-medium">{conjugation.participle}</dd>
          </div>
        </dl>
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={voseo}
            onChange={(e) => setVoseo(e.target.checked)}
            className="size-4 accent-emerald-700"
          />
          <span>
            Show voseo (<span className="italic">vos</span>)
          </span>
        </label>
      </div>

      {/* Verb pages are long on a phone, so jump straight to a mood. */}
      <nav aria-label="Jump to a mood" className="flex flex-wrap gap-2">
        {MOODS.map((mood) => (
          <a
            key={mood.id}
            href={`#${mood.id}`}
            className="flex min-h-10 items-center rounded-full border border-zinc-200 px-4 text-sm transition hover:border-emerald-600 dark:border-zinc-700"
          >
            {mood.title}
          </a>
        ))}
      </nav>

      {MOODS.map((mood) => (
        <div key={mood.id} id={mood.id} className="scroll-mt-4">
          <h2 className="mb-4 text-xl font-semibold">
            {mood.title} <span className="font-normal text-zinc-500">· {mood.spanish}</span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TENSES.filter((t) => t.mood === mood.id).map((meta) => {
              const forms = conjugation.tenses[meta.id];
              return forms ? (
                <TenseCard key={meta.id} meta={meta} forms={forms} voseo={voseo} sentence={sentences?.[meta.id]} />
              ) : null;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { TENSES, type Conjugation, type Mood, type TenseForms, type TenseMeta } from "@/lib/conjugation/types";

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

function TenseCard({ meta, forms, voseo }: { meta: TenseMeta; forms: TenseForms; voseo: boolean }) {
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
          <div key={r.label} className="grid grid-cols-[9rem_1fr] gap-3 py-1.5">
            <dt className={`text-sm ${r.vos ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500"}`}>{r.label}</dt>
            <dd className={`font-medium ${r.vos ? "text-emerald-800 dark:text-emerald-300" : ""}`}>{r.form}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function ConjugationView({ conjugation }: { conjugation: Conjugation }) {
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
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={voseo}
            onChange={(e) => setVoseo(e.target.checked)}
            className="size-4 accent-emerald-700"
          />
          Show voseo (<span className="italic">vos</span>)
        </label>
      </div>

      {MOODS.map((mood) => (
        <div key={mood.id}>
          <h2 className="mb-4 text-xl font-semibold">
            {mood.title} <span className="font-normal text-zinc-500">· {mood.spanish}</span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TENSES.filter((t) => t.mood === mood.id).map((meta) => {
              const forms = conjugation.tenses[meta.id];
              return forms ? <TenseCard key={meta.id} meta={meta} forms={forms} voseo={voseo} /> : null;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

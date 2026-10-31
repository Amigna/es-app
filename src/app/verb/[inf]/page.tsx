import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import ConjugationView from "@/components/ConjugationView";
import VerbSearch from "@/components/VerbSearch";
import { conjugate } from "@/lib/conjugation/engine";
import { IRREGULARS } from "@/lib/conjugation/irregulars";
import { getSentences } from "@/lib/sentence-data";
import { VERBS, VERB_SHAPE, findVerb, verbSlug, type Verb } from "@/lib/verbs";

export function generateStaticParams() {
  return VERBS.map((v) => ({ inf: verbSlug(v.inf) }));
}

function resolve(slug: string): { verb: Verb; listed: boolean } | null {
  let q: string;
  try {
    q = decodeURIComponent(slug).toLowerCase();
  } catch {
    return null;
  }
  const listed = findVerb(q);
  if (listed) return { verb: listed, listed: true };
  // Not in the curated list: conjugate by the regular rules only.
  if (VERB_SHAPE.test(q)) return { verb: { inf: q, en: "" }, listed: false };
  return null;
}

export async function generateMetadata({ params }: PageProps<"/verb/[inf]">): Promise<Metadata> {
  const found = resolve((await params).inf);
  return { title: found ? `${found.verb.inf} · Conjugar` : "Verb not found · Conjugar" };
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {children}
    </span>
  );
}

// The shell (search box) is the same for every verb; the URL-specific part streams in behind Suspense.
export default function VerbPage({ params }: PageProps<"/verb/[inf]">) {
  return (
    <div className="space-y-8">
      <VerbSearch />
      <Suspense fallback={<VerbSkeleton />}>
        <VerbContent params={params} />
      </Suspense>
    </div>
  );
}

function VerbSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="h-10 w-48 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      <div className="h-5 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
    </div>
  );
}

async function VerbContent({ params }: { params: PageProps<"/verb/[inf]">["params"] }) {
  const found = resolve((await params).inf);
  if (!found) notFound();
  const { verb, listed } = found;
  const conjugation = conjugate(verb);
  const sentences = getSentences(verb.inf);
  const root = verb.inf.replace(/se$/, "");

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">{conjugation.infinitive}</h1>
        {verb.en && <p className="text-lg text-zinc-600 dark:text-zinc-400">{verb.en}</p>}
        <div className="flex flex-wrap gap-2">
          {conjugation.reflexive && <Chip>reflexive</Chip>}
          {(verb.like || IRREGULARS[root]) && <Chip>irregular{verb.like ? ` · like ${verb.like}` : ""}</Chip>}
          {verb.boot && <Chip>stem change {verb.boot.replace(">", " → ")}</Chip>}
          {verb.accent && <Chip>accent shifts (envío)</Chip>}
        </div>
        {!listed && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            This verb isn’t in the curated list yet, so it’s conjugated by the regular rules. If it has a stem change or
            other irregularity, some forms below may be wrong.
          </p>
        )}
      </header>

      <ConjugationView conjugation={conjugation} sentences={sentences} />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ReadingQuiz from "@/components/ReadingQuiz";
import ReportProblem from "@/components/ReportProblem";
import { READINGS, findReading } from "@/lib/reading-data";

export function generateStaticParams() {
  return READINGS.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: PageProps<"/reading/[slug]">): Promise<Metadata> {
  const reading = findReading((await params).slug);
  return { title: reading ? `${reading.title} · Conjugar` : "Reading not found · Conjugar" };
}

// The back link is shared by every passage; the URL-specific part streams in behind Suspense.
export default function ReadingPassagePage({ params }: PageProps<"/reading/[slug]">) {
  return (
    <div className="space-y-6">
      <Link href="/reading" className="text-sm text-accent-700 underline dark:text-accent-400">
        All readings
      </Link>
      <Suspense fallback={<div className="h-10 w-64 animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800" aria-busy="true" />}>
        <ReadingContent params={params} />
      </Suspense>
    </div>
  );
}

async function ReadingContent({ params }: { params: PageProps<"/reading/[slug]">["params"] }) {
  const reading = findReading((await params).slug);
  if (!reading) notFound();

  return (
    <article className="max-w-2xl space-y-8">
      <header className="space-y-1">
        <p className="text-sm text-stone-500">
          {reading.level} · <span lang="es">{reading.place}</span>
        </p>
        <h1 lang="es" className="text-3xl font-semibold tracking-tight">
          {reading.title}
        </h1>
        <p className="text-lg text-stone-600 dark:text-stone-400">{reading.en}</p>
      </header>

      <section className="space-y-4">
        {reading.paragraphs.map((p) => (
          <div key={p.es}>
            <p lang="es" className="text-lg leading-relaxed">
              {p.es}
            </p>
            <details className="text-stone-600 dark:text-stone-400">
              <summary className="w-fit cursor-pointer py-2.5 text-sm text-accent-700 dark:text-accent-400">Show English</summary>
              <p className="border-l-2 border-stone-300 pl-3 dark:border-stone-700">{p.en}</p>
            </details>
          </div>
        ))}
        <ReportProblem about={`Reading: ${reading.title}`} />
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Words to know</h2>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {reading.words.map((w) => (
            <div key={w.es}>
              <dt lang="es" className="font-medium text-accent-800 dark:text-accent-300">
                {w.es}
              </dt>
              <dd className="text-sm text-stone-500">{w.en}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Check your understanding</h2>
        <ReadingQuiz reading={reading} />
      </section>
    </article>
  );
}

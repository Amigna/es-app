import type { Metadata } from "next";
import Link from "next/link";
import { chapterForReading, chapterNumber, type Chapter } from "@/lib/course";
import { READINGS } from "@/lib/reading-data";
import { LEVELS, type Reading } from "@/lib/readings";

export const metadata: Metadata = { title: "Reading" };

function ReadingCard({ reading, chapter }: { reading: Reading; chapter?: Chapter }) {
  return (
    <li>
      <Link
        href={`/reading/${reading.slug}`}
        className="block h-full rounded-xl border border-stone-200 bg-white p-4 transition hover:border-accent-600 dark:border-stone-800 dark:bg-stone-900"
      >
        {chapter && (
          <span className="mb-1 block text-sm text-stone-500">
            Chapter {chapterNumber(chapter)}: {chapter.title}
          </span>
        )}
        <span lang="es" className="block text-lg font-semibold">
          {reading.title}
        </span>
        <span className="mt-1 block text-stone-600 dark:text-stone-400">
          {reading.en} · <span lang="es">{reading.place}</span>
        </span>
      </Link>
    </li>
  );
}

export default function ReadingPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Reading</h1>
        <p className="text-stone-600 dark:text-stone-400">
          Short stories from across Latin America and the Caribbean, each with a translation, key words and questions.
        </p>
      </header>

      {LEVELS.map((level) => {
        const passages = READINGS.filter((r) => r.level === level.id).map((r) => ({ reading: r, chapter: chapterForReading(r.slug) }));
        const stories = passages.filter((p) => !p.chapter);
        // In course order, so they read as the chapters do.
        const fromCourse = passages.filter((p) => p.chapter).sort((a, b) => chapterNumber(a.chapter!) - chapterNumber(b.chapter!));
        return (
          <section key={level.id} className="space-y-3">
            <div>
              <h2 className="text-xl font-semibold">
                {level.id} · {level.name}
              </h2>
              <p className="text-sm text-stone-500">{level.grammar}</p>
            </div>
            {stories.length > 0 && (
              <ul className="grid gap-3 md:grid-cols-2">
                {stories.map((p) => (
                  <ReadingCard key={p.reading.slug} reading={p.reading} />
                ))}
              </ul>
            )}
            {fromCourse.length > 0 && (
              <section className="space-y-3 rounded-2xl border border-accent-200 bg-accent-50/50 p-4 dark:border-accent-900 dark:bg-accent-950/30">
                <div>
                  <h3 className="font-semibold">
                    From the{" "}
                    <Link href="/course" className="text-accent-700 underline dark:text-accent-400">
                      course
                    </Link>
                  </h3>
                  <p className="text-sm text-stone-500">Each one is written for a chapter, using its grammar and words. It&apos;s also that chapter&apos;s Read step.</p>
                </div>
                <ul className="grid gap-3 md:grid-cols-2">
                  {fromCourse.map((p) => (
                    <ReadingCard key={p.reading.slug} reading={p.reading} chapter={p.chapter} />
                  ))}
                </ul>
              </section>
            )}
          </section>
        );
      })}
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import CourseChapter, { type TenseSentences } from "@/components/CourseChapter";
import { chapterQuiz, chapterSentences, rareKeys } from "@/lib/chapter-quiz";
import { CHAPTERS, findChapter, type Chapter } from "@/lib/course";
import { findGuide } from "@/lib/guides";
import { findReading } from "@/lib/reading-data";
import { SENTENCE_BANK } from "@/lib/sentence-data";
import { sentencesFor } from "@/lib/sentences";

/** Example sentences See it shows per tense. The model verbs' tables are in the lesson. */
const EXAMPLES_PER_TENSE = 10;

export function generateStaticParams() {
  return CHAPTERS.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: PageProps<"/course/[id]">): Promise<Metadata> {
  const chapter = findChapter((await params).id);
  return { title: chapter ? chapter.title : "Chapter not found" };
}

export default function ChapterPage({ params }: PageProps<"/course/[id]">) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-10 w-64 animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800" aria-busy="true" />}>
        <ChapterContent params={params} />
      </Suspense>
    </div>
  );
}

/** The guide's sections for the chapter, in the guide's order. */
function lessonFor(chapter: Chapter) {
  const guide = chapter.guide && findGuide(chapter.guide.slug);
  if (!guide || !chapter.guide) return { sections: [], quiz: null };
  const only = chapter.guide.sections;
  return { sections: only ? guide.sections.filter((s) => only.includes(s.heading)) : guide.sections, quiz: chapterQuiz(chapter) };
}

/** Each model verb's sentences for each tense, and the main sentence of other chapter verbs for more examples. */
function seeItSentences(chapter: Chapter) {
  const tables: TenseSentences[] = [];
  const examples: TenseSentences[] = [];
  const models = chapter.models ?? [];
  for (const tense of chapter.tenses) {
    for (const inf of models) tables.push({ inf, tense, sentences: sentencesFor(SENTENCE_BANK, inf, tense).slice(0, 1) });
    // Model verbs' other persons first, then the main sentence of other verbs in the chapter.
    const more: TenseSentences[] = [
      ...models.map((inf) => ({ inf, tense, sentences: sentencesFor(SENTENCE_BANK, inf, tense).slice(1, 2) })),
      ...chapter.verbs.filter((v) => !models.includes(v)).map((inf) => ({ inf, tense, sentences: sentencesFor(SENTENCE_BANK, inf, tense).slice(0, 1) })),
    ].filter((e) => e.sentences.length > 0);
    examples.push(...more.slice(0, EXAMPLES_PER_TENSE));
  }
  return { tables, examples };
}

async function ChapterContent({ params }: { params: PageProps<"/course/[id]">["params"] }) {
  const chapter = findChapter((await params).id);
  if (!chapter) notFound();
  const { sections, quiz } = lessonFor(chapter);
  const { tables, examples } = seeItSentences(chapter);
  return (
    <CourseChapter
      chapter={chapter}
      sections={sections}
      quiz={quiz}
      tables={tables}
      examples={examples}
      rare={rareKeys(chapter)}
      extra={chapterSentences(chapter.id)}
      reading={(chapter.reading && findReading(chapter.reading)) || null}
    />
  );
}

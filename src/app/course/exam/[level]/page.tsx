import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import CourseExam from "@/components/CourseExam";
import { chapterQuiz } from "@/lib/chapter-quiz";
import { EXAM_LEVELS, EXAM_REVIEW, levelChapters } from "@/lib/course";
import type { ChapterQuiz } from "@/lib/course-decks";
import type { Level } from "@/lib/level";

const levelFrom = (param: string) => EXAM_LEVELS.find((l) => l.toLowerCase() === param.toLowerCase());

export function generateStaticParams() {
  return EXAM_LEVELS.map((l) => ({ level: l.toLowerCase() }));
}

export async function generateMetadata({ params }: PageProps<"/course/exam/[level]">): Promise<Metadata> {
  const level = levelFrom((await params).level);
  return { title: level ? `${level} exam` : "Exam not found" };
}

export default function ExamPage({ params }: PageProps<"/course/exam/[level]">) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-10 w-64 animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800" aria-busy="true" />}>
        <ExamContent params={params} />
      </Suspense>
    </div>
  );
}

async function ExamContent({ params }: { params: PageProps<"/course/exam/[level]">["params"] }) {
  const level: Level | undefined = levelFrom((await params).level);
  if (!level) notFound();
  const quizzes: ChapterQuiz[] = levelChapters(level).flatMap((c) => chapterQuiz(c) ?? []);
  // Only levels that review earlier ones send those quizzes to the browser.
  const earlier = EXAM_REVIEW[level] ? EXAM_LEVELS.slice(0, EXAM_LEVELS.indexOf(level)) : [];
  const review: ChapterQuiz[] = earlier.flatMap((l) => levelChapters(l).flatMap((c) => chapterQuiz(c) ?? []));
  return <CourseExam level={level} quizzes={quizzes} review={review} />;
}

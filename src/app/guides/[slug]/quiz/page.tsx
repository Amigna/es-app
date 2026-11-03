import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import GuideQuiz from "@/components/GuideQuiz";
import { GUIDES, findGuide } from "@/lib/guides";
import { GUIDE_QUIZZES } from "@/lib/quiz-data";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]/quiz">): Promise<Metadata> {
  const guide = findGuide((await params).slug);
  return { title: guide ? `${guide.title} quiz · Conjugar` : "Quiz not found · Conjugar" };
}

export default function QuizPage({ params }: PageProps<"/guides/[slug]/quiz">) {
  return (
    <Suspense fallback={<div className="h-10 w-64 animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800" aria-busy="true" />}>
      <QuizContent params={params} />
    </Suspense>
  );
}

async function QuizContent({ params }: { params: PageProps<"/guides/[slug]/quiz">["params"] }) {
  const { slug } = await params;
  const guide = findGuide(slug);
  const questions = GUIDE_QUIZZES[slug];
  if (!guide || !questions) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{guide.title} quiz</h1>
      <GuideQuiz slug={slug} title={guide.title} questions={questions} />
    </div>
  );
}

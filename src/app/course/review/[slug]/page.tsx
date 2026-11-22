import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import CourseReview, { type ReviewPart } from "@/components/CourseReview";
import { chapterQuiz, chapterSentences, rareKeys } from "@/lib/chapter-quiz";
import { REVIEWS, findReview, reviewChapters, reviewTitle } from "@/lib/course";

export function generateStaticParams() {
  return REVIEWS.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: PageProps<"/course/review/[slug]">): Promise<Metadata> {
  const review = findReview((await params).slug);
  return { title: review ? reviewTitle(review) : "Review not found" };
}

export default function ReviewPage({ params }: PageProps<"/course/review/[slug]">) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-10 w-64 animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800" aria-busy="true" />}>
        <ReviewContent params={params} />
      </Suspense>
    </div>
  );
}

async function ReviewContent({ params }: { params: PageProps<"/course/review/[slug]">["params"] }) {
  const review = findReview((await params).slug);
  if (!review) notFound();
  // Each chapter's share of what its own checkpoint uses: its quiz, its own sentences and its rare tenses.
  const parts: ReviewPart[] = reviewChapters(review).map((chapter) => ({
    id: chapter.id,
    quiz: chapterQuiz(chapter),
    extra: chapterSentences(chapter.id),
    rare: rareKeys(chapter),
  }));
  return <CourseReview slug={review.slug} parts={parts} />;
}

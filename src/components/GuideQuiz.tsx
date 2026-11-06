"use client";

import { useState } from "react";
import DrillRunner from "@/components/DrillRunner";
import type { Card } from "@/lib/drill";
import { QUIZ_RUN, quizDeck, type QuizQuestion } from "@/lib/quiz";
import { quizSeen, remembering } from "@/lib/quiz-seen";

export default function GuideQuiz({ slug, title, questions }: { slug: string; title: string; questions: QuizQuestion[] }) {
  const [session, setSession] = useState<{ first: Card; next: () => Card | null } | null>(null);

  // Shuffling happens on click, because a random order in the server render wouldn't match the browser's.
  function start() {
    const next = remembering(quizDeck({ [slug]: questions }, [{ slug, title }], Math.random, { seen: quizSeen(), perGuide: QUIZ_RUN }));
    const first = next();
    if (first) setSession({ first, next });
  }

  if (session) return <DrillRunner first={session.first} next={session.next} onStop={() => setSession(null)} />;

  return (
    <div className="space-y-4">
      <p className="text-stone-600 dark:text-stone-400">
        {Math.min(questions.length, QUIZ_RUN)} questions
        {questions.length > QUIZ_RUN && `, drawn from ${questions.length} so each try is different, starting with ones you haven't seen lately`}. Each
        answer comes with a short explanation, and anything you miss comes back.
      </p>
      <button
        type="button"
        onClick={start}
        className="h-12 rounded-xl bg-accent-700 px-6 font-medium text-white transition hover:bg-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
      >
        Start quiz
      </button>
    </div>
  );
}

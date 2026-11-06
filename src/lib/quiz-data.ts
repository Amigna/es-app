import guidesRaw from "../data/guides.json";
import raw from "../data/guide-quizzes.json";
import type { Guide } from "./guides";
import type { GuideQuizzes } from "./quiz";

const guides = guidesRaw as Guide[];

/** Each question with its guide rule attached in full, so a miss can show it. */
export const GUIDE_QUIZZES: GuideQuizzes = Object.fromEntries(
  Object.entries(raw as GuideQuizzes).map(([slug, questions]) => {
    const rules = guides.find((g) => g.slug === slug)?.sections.flatMap((s) => s.rules) ?? [];
    return [slug, questions.map((q) => ({ ...q, lesson: rules.find((r) => r.rule === q.rule) }))];
  }),
);

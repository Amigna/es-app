import courseRaw from "../data/course.json";
import type { TenseId } from "./conjugation/types";
import type { Level } from "./level";

// A path through the grammar, one topic per chapter, built from the guides, sentences, words and drills the app already
// has. Every chapter stays open: the level only suggests where to start. Progress is kept in this browser, and for
// signed-in people merged into users/{uid}/stats/course.

export type StepId = "learn" | "see" | "words" | "quiz" | "practice" | "write" | "checkpoint";
/**
 * Verb forms; `choose`, fill in the blank with the tense hidden, for chapters about choosing between tenses; or for
 * chapters about nouns and adjectives, gender and agreement questions on the chapter's words.
 */
export type ChapterDrill = "conjugation" | "blanks" | "choose" | "gender" | "agreement";

export interface Chapter {
  id: string;
  title: string;
  level: Level;
  summary: string;
  /** The lesson. `sections` limits it to some of the guide's headings, and `quiz` to some of its questions, by position. */
  guide?: { slug: string; sections?: string[]; quiz?: number[] };
  tenses: TenseId[];
  /** Verbs whose tables the "See it" step shows. Without them the step is left out. */
  models?: string[];
  /** The verbs practice and writing draw from. */
  verbs: string[];
  /** Empty when there's nothing to drill beyond the quiz, like object pronouns. */
  drills: ChapterDrill[];
  /** A short lesson between chapters: the guide and its quiz, with no words or practice. */
  lesson?: boolean;
  /** Words for the chapter's theme, written `type:es`, like `noun:casa` or `phrase:Tengo prisa.`. */
  words: string[];
}

export const CHAPTERS = courseRaw as Chapter[];

/** A checkpoint score at or above this finishes the chapter. */
export const PASS_SCORE = 80;

export const STEPS: { id: StepId; title: string; hint: string }[] = [
  { id: "learn", title: "Learn", hint: "A short lesson" },
  { id: "see", title: "See it", hint: "The pattern and real sentences" },
  { id: "words", title: "Words", hint: "Flashcards for the chapter's theme" },
  { id: "quiz", title: "Quiz", hint: "Questions on the lesson" },
  { id: "practice", title: "Practice", hint: "Conjugation and fill in the blank" },
  { id: "write", title: "Write", hint: "Translate a few sentences" },
  { id: "checkpoint", title: "Checkpoint", hint: `A short mixed test. ${PASS_SCORE}% finishes the chapter` },
];

export const findChapter = (id: string) => CHAPTERS.find((c) => c.id === id);

export const chapterNumber = (chapter: Chapter) => CHAPTERS.indexOf(chapter) + 1;

/** The steps a chapter has content for, in order. A guide quiz limited to no questions leaves the quiz out. */
export function chapterSteps(chapter: Chapter): StepId[] {
  const has: Record<StepId, boolean> = {
    learn: !!chapter.guide,
    see: (chapter.models?.length ?? 0) > 0,
    words: chapter.words.length > 0,
    quiz: !!chapter.guide && chapter.guide.quiz?.length !== 0,
    practice: chapter.drills.length > 0,
    write: chapter.tenses.length > 0 && chapter.verbs.length > 0,
    checkpoint: true,
  };
  return STEPS.map((s) => s.id).filter((id) => has[id]);
}

export interface CheckpointTry {
  day: string;
  score: number;
}

export interface ChapterProgress {
  /** Steps finished at least once. The checkpoint is only listed once passed. */
  steps: StepId[];
  /** The best checkpoint score. */
  best?: number;
  /** The day the checkpoint was first passed. */
  done?: string;
  /** Checkpoint scores, oldest first, so /progress can show improvement. */
  tries?: CheckpointTry[];
  /** When it was last worked on, for "Continue". */
  at?: number;
}

export type CourseProgress = Record<string, ChapterProgress>;

export const MAX_TRIES = 20;
export const STEP_IDS = STEPS.map((s) => s.id);
const CHAPTER_IDS = new Set(CHAPTERS.map((c) => c.id));

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isDay = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Saved data can be old or hand-edited, so anything unrecognized is dropped. Chapters no longer in the course are kept. */
export function parseCourse(raw: unknown): CourseProgress {
  if (!raw || typeof raw !== "object") return {};
  const out: CourseProgress = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    const chapter: ChapterProgress = { steps: Array.isArray(v.steps) ? STEP_IDS.filter((s) => (v.steps as unknown[]).includes(s)) : [] };
    if (isNumber(v.best)) chapter.best = v.best;
    if (isDay(v.done)) chapter.done = v.done;
    if (Array.isArray(v.tries)) {
      const tries = v.tries.filter((t): t is CheckpointTry => !!t && isDay(t.day) && isNumber(t.score));
      if (tries.length > 0) chapter.tries = tries.map(({ day, score }) => ({ day, score }));
    }
    if (isNumber(v.at)) chapter.at = v.at;
    out[id] = chapter;
  }
  return out;
}

/** Combines two copies, say this browser's and the account's, losing nothing either one finished. */
export function mergeCourse(a: CourseProgress, b: CourseProgress): CourseProgress {
  const out: CourseProgress = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const [x, y] = [a[id], b[id]];
    if (!x || !y) {
      out[id] = (x ?? y)!;
      continue;
    }
    const merged: ChapterProgress = { steps: STEP_IDS.filter((s) => x.steps.includes(s) || y.steps.includes(s)) };
    const best = Math.max(x.best ?? -1, y.best ?? -1);
    if (best >= 0) merged.best = best;
    const done = [x.done, y.done].filter(isDay).sort()[0];
    if (done) merged.done = done;
    // The same try can be in both copies, so exact repeats count once.
    const seen = new Set<string>();
    const tries = [...(x.tries ?? []), ...(y.tries ?? [])]
      .filter((t) => !seen.has(`${t.day}|${t.score}`) && !!seen.add(`${t.day}|${t.score}`))
      .sort((p, q) => p.day.localeCompare(q.day))
      .slice(-MAX_TRIES);
    if (tries.length > 0) merged.tries = tries;
    const at = Math.max(x.at ?? 0, y.at ?? 0);
    if (at > 0) merged.at = at;
    out[id] = merged;
  }
  return out;
}

export const sameCourse = (a: CourseProgress, b: CourseProgress) => JSON.stringify(a) === JSON.stringify(b);

export const isDone = (progress: CourseProgress, id: string) => !!progress[id]?.done;

/** The first step not yet finished, or null when the chapter is done. */
export function nextStep(chapter: Chapter, progress: CourseProgress): StepId | null {
  if (isDone(progress, chapter.id)) return null;
  const finished = progress[chapter.id]?.steps ?? [];
  return chapterSteps(chapter).find((s) => !finished.includes(s)) ?? "checkpoint";
}

/** Where the level suggests starting: its first chapter. With no level, the beginning. */
export function levelStart(level: Level | null): number {
  const index = level ? CHAPTERS.findIndex((c) => c.level === level) : 0;
  return Math.max(0, index);
}

/**
 * The chapter to continue: the one last worked on if it isn't done, otherwise the first unfinished one from where the
 * level starts, then any unfinished one. Null when every chapter is done.
 */
export function suggestedChapter(progress: CourseProgress, level: Level | null): Chapter | null {
  const open = CHAPTERS.filter((c) => !isDone(progress, c.id));
  const recent = open.filter((c) => progress[c.id]?.at).sort((a, b) => progress[b.id].at! - progress[a.id].at!)[0];
  if (recent) return recent;
  const start = levelStart(level);
  return open.find((c) => CHAPTERS.indexOf(c) >= start) ?? open[0] ?? null;
}

// Each level ends with an exam of questions from its chapters' quizzes. Passing it earns the level's badge. Like chapters,
// it's always open. Its tries are kept with the chapters, under `exam:A1` and so on, so they save and merge the same way.

/** Questions in a level exam, or fewer when its quizzes don't have that many. */
export const EXAM_SIZE = 40;
/** Higher than a checkpoint's, since the exam stands for the whole level. */
export const EXAM_PASS_SCORE = 90;
/** Of the exam's questions, how many review earlier levels. B2 ends the course, so its exam covers all of it. */
export const EXAM_REVIEW: Partial<Record<Level, number>> = { B2: 10 };

/** Levels with chapters, so with an exam. */
export const EXAM_LEVELS: Level[] = [...new Set(CHAPTERS.map((c) => c.level))];

export const examId = (level: Level) => `exam:${level}`;

export const levelChapters = (level: Level) => CHAPTERS.filter((c) => c.level === level);

/** Chapters finished, counting only chapters still in the course. */
export const chaptersDone = (progress: CourseProgress) => Object.keys(progress).filter((id) => CHAPTER_IDS.has(id) && isDone(progress, id)).length;

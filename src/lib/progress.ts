import type { TenseId } from "./conjugation/types";
import type { Grade } from "./drill";

// What gets tracked and how it's added up. No Firebase here, so it's safe to load anywhere.

/** What a question counts toward: verb + tense, word + question type, or a guide question. */
export interface Track {
  item: string;
  tense?: TenseId;
}

export interface Answer extends Track {
  grade: Grade;
  day: string;
}

export interface Tally {
  right: number;
  accent: number;
  wrong: number;
}

export interface Summary {
  items: Record<string, Tally & { last: string }>;
  days: Record<string, Tally>;
  tenses: Record<string, Tally>;
  total: Tally;
}

const FIELD: Record<Grade, keyof Tally> = { correct: "right", accent: "accent", wrong: "wrong" };

const empty = (): Tally => ({ right: 0, accent: 0, wrong: 0 });

/** Today in the learner's own time zone, so streaks follow their calendar. */
export function localDay(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Combines a batch of answers, so saving them takes a few writes instead of one per answer. */
export function summarize(answers: Answer[]): Summary {
  const out: Summary = { items: {}, days: {}, tenses: {}, total: empty() };
  for (const a of answers) {
    const field = FIELD[a.grade];
    const item = (out.items[a.item] ??= { ...empty(), last: a.day });
    item[field]++;
    if (a.day > item.last) item.last = a.day;
    (out.days[a.day] ??= empty())[field]++;
    if (a.tense) (out.tenses[a.tense] ??= empty())[field]++;
    out.total[field]++;
  }
  return out;
}

export const answered = (t: Tally) => t.right + t.accent + t.wrong;

/** Share answered fully correctly. An accent slip doesn't count as correct. */
export function accuracy(t: Tally): number | null {
  const n = answered(t);
  return n === 0 ? null : Math.round((t.right / n) * 100);
}

function previousDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d - 1));
}

/** Consecutive days practiced, ending today. Yesterday still counts, so a streak isn't lost before today's practice. */
export function currentStreak(days: string[], today: string): number {
  const practiced = new Set(days);
  let cursor = practiced.has(today) ? today : previousDay(today);
  let streak = 0;
  while (practiced.has(cursor)) {
    streak++;
    cursor = previousDay(cursor);
  }
  return streak;
}

/** Answers across the seven days ending today. */
export function lastSevenDays(days: Record<string, Tally>, today: string): number {
  let total = 0;
  let cursor = today;
  for (let i = 0; i < 7; i++) {
    total += days[cursor] ? answered(days[cursor]) : 0;
    cursor = previousDay(cursor);
  }
  return total;
}

import type { TenseId } from "./conjugation/types";
import type { Grade } from "./drill";

// What gets tracked and how it's added up. No Firebase here, so it's safe to load anywhere.

/** What a question counts toward: verb + tense, word + question type, or a guide question. */
export interface Track {
  item: string;
  tense?: TenseId;
}

/** What was typed on a miss, so the progress page can show real mistakes and not only rates. */
export interface Mistake {
  item: string;
  /** The question type or tense, like "Preterite". */
  label: string;
  /** What was asked, like "hablar · Preterite · yo". */
  prompt: string;
  /** Empty when they said they didn't know. */
  given: string;
  answer: string;
  grade: "accent" | "wrong";
}

export interface Answer extends Track {
  grade: Grade;
  day: string;
  /** Typed answers that weren't fully right. Absent for self-graded cards, where nothing was typed. */
  mistake?: Omit<Mistake, "item" | "grade">;
}

/** The most answers in a row a drill has counted, and the day it was reached. */
export interface StreakRecord {
  streak: number;
  day: string;
}

/**
 * The streak carried from drill to drill through a day, so it follows the learner between devices. A miss or a new
 * day starts it again. `at` is when it last changed, so the newest copy wins.
 */
export interface RunningStreak {
  day: string;
  streak: number;
  /** The longest it reached that day. */
  best: number;
  at: number;
}

export interface Tally {
  right: number;
  accent: number;
  wrong: number;
}

/** A saved day. `writing` is by direction and `listening` by kind, kept per day so they can be compared over time. */
export type DayTally = Tally & {
  writing?: Record<string, Tally>;
  listening?: Record<string, Tally>;
  mistakes?: Mistake[];
  /** Mistakes the person removed from their list. They're kept in `mistakes` and still count in every tally. */
  hiddenMistakes?: Mistake[];
  reviews?: number;
  /** The longest drill streak that day. */
  bestStreak?: number;
};

export interface Summary {
  items: Record<string, Tally & { last: string }>;
  days: Record<string, Tally>;
  tenses: Record<string, Tally>;
  verbs: Record<string, Tally>;
  /** By question type: gender, agreement, toSpanish or toEnglish. */
  kinds: Record<string, Tally>;
  /** By direction: toEnglish or toSpanish. */
  writing: Record<string, Tally>;
  /** The same, by day. */
  writingDays: Record<string, Record<string, Tally>>;
  /** Dictation and any later listening drills, by kind. */
  listening: Record<string, Tally>;
  listeningDays: Record<string, Record<string, Tally>>;
  /** By day. */
  mistakes: Record<string, Mistake[]>;
  total: Tally;
}

/** Long prompts like a whole sentence are cut, to keep a day's saved list small. */
const MAX_MISTAKE_TEXT = 300;

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
  const out: Summary = {
    items: {},
    days: {},
    tenses: {},
    verbs: {},
    kinds: {},
    writing: {},
    writingDays: {},
    listening: {},
    listeningDays: {},
    mistakes: {},
    total: empty(),
  };
  for (const a of answers) {
    const field = FIELD[a.grade];
    const item = (out.items[a.item] ??= { ...empty(), last: a.day });
    item[field]++;
    if (a.day > item.last) item.last = a.day;
    (out.days[a.day] ??= empty())[field]++;
    if (a.tense) (out.tenses[a.tense] ??= empty())[field]++;
    // Items are verb:hablar:present or vocab:noun:casa:gender. Words and phrases can't contain a colon; a test checks that.
    const [source, first, , kind] = a.item.split(":");
    if (source === "verb") (out.verbs[first] ??= empty())[field]++;
    if (source === "vocab" && kind) (out.kinds[kind] ??= empty())[field]++;
    if (source === "writing") {
      (out.writing[first] ??= empty())[field]++;
      ((out.writingDays[a.day] ??= {})[first] ??= empty())[field]++;
    }
    if (source === "listening") {
      (out.listening[first] ??= empty())[field]++;
      ((out.listeningDays[a.day] ??= {})[first] ??= empty())[field]++;
    }
    if (a.mistake && a.grade !== "correct") {
      const m = a.mistake;
      const cut = (s: string) => s.slice(0, MAX_MISTAKE_TEXT);
      // Every field is a plain string, because Firestore refuses undefined values.
      (out.mistakes[a.day] ??= []).push({
        item: a.item,
        label: cut(m.label ?? ""),
        prompt: cut(m.prompt ?? ""),
        given: cut(m.given ?? ""),
        answer: cut(m.answer ?? ""),
        grade: a.grade,
      });
    }
    out.total[field]++;
  }
  return out;
}

export const answered = (t: Tally) => t.right + t.accent + t.wrong;

/** Different words started, by type. A word counts once whatever question was asked about it. */
export function wordsPracticed(items: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const words = new Set(items.filter((item) => item.startsWith("vocab:")).map((item) => item.split(":").slice(1, 3).join(":")));
  for (const word of words) {
    const [type] = word.split(":");
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

/**
 * Share right out of right and wrong. Accent slips are left out of both, so they neither lower nor pad it, and are
 * counted on their own by accentRate. Null when there's nothing to count.
 */
export function accuracy(t: Tally): number | null {
  const n = t.right + t.wrong;
  return n === 0 ? null : Math.round((t.right / n) * 100);
}

/** Share of all answers that were accent slips: right letters, wrong or missing accent. */
export function accentRate(t: Tally): number | null {
  const n = answered(t);
  return n === 0 ? null : Math.round((t.accent / n) * 100);
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

/** Tallies for seven-day stretches going back from today, newest first. Empty stretches are kept so the positions mean something. */
export function recentWeeks<T>(days: Record<string, T>, today: string, pick: (day: T) => Tally | undefined, count: number): Tally[] {
  let cursor = today;
  return Array.from({ length: count }, () => {
    const week = empty();
    for (let i = 0; i < 7; i++) {
      const tally = days[cursor] && pick(days[cursor]);
      if (tally) {
        week.right += tally.right;
        week.accent += tally.accent;
        week.wrong += tally.wrong;
      }
      cursor = previousDay(cursor);
    }
    return week;
  });
}

/** The longest drill streak in each seven-day stretch going back from today, newest first. 0 for none. */
export function weeklyBestStreaks(days: Record<string, { bestStreak?: number }>, today: string, count: number): number[] {
  let cursor = today;
  return Array.from({ length: count }, () => {
    let best = 0;
    for (let i = 0; i < 7; i++) {
      best = Math.max(best, days[cursor]?.bestStreak ?? 0);
      cursor = previousDay(cursor);
    }
    return best;
  });
}

export interface CalendarDay {
  day: string;
  answered: number;
  /** Later than today, in the current week's column. */
  future: boolean;
}

/** Weeks for a practice calendar, oldest first, each running Monday to Sunday. The last one holds today. */
export function calendarWeeks(days: Record<string, Tally>, today: string, count: number): CalendarDay[][] {
  const [y, m, d] = today.split("-").map(Number);
  const mondayOffset = (new Date(y, m - 1, d).getDay() + 6) % 7;
  const start = d - mondayOffset - 7 * (count - 1);
  return Array.from({ length: count }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const day = localDay(new Date(y, m - 1, start + w * 7 + i));
      return { day, answered: days[day] ? answered(days[day]) : 0, future: day > today };
    }),
  );
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

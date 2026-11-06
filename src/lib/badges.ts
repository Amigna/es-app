import { CHAPTERS, PASS_SCORE, chapterNumber, isDone, type CourseProgress } from "./course";
import { LEVELS, type Level } from "./level";
import type { StreakRecord } from "./progress";

// Badges reward learning, not activity: chapters finished, things mastered, streaks kept and checkpoints improved.
// No XP. They're private, shown on /progress, and drawn in code by the Badge component.

export type BadgeTier = "chapter" | "level" | "course" | "milestone";
export type BadgeIcon = "check" | "flame" | "bolt" | "up" | "star";

export interface Badge {
  id: string;
  title: string;
  /** How it's earned, shown under the title. */
  detail: string;
  tier: BadgeTier;
  hue: number;
  /** Short text in the middle, like a chapter number or a level. */
  label?: string;
  icon?: BadgeIcon;
}

/** A hue per level, so a level's chapters and its badge share a color. */
export const LEVEL_HUES: Record<Level, number> = { A1: 150, A2: 205, B1: 270, B2: 25 };

export const DAY_STREAKS = [7, 30, 100];
export const DRILL_STREAKS = [25, 50];
export const MASTERED = [25, 100, 250, 500, 1000];
/** A comeback is a checkpoint retaken from under PASS_SCORE to at least this. */
export const COMEBACK_SCORE = 90;

const plural = (n: number, word: string) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

/** Every badge, in the order /progress lists them. */
export const BADGES: Badge[] = [
  ...CHAPTERS.map((c): Badge => ({
    id: `chapter:${c.id}`,
    title: c.title,
    detail: `Passed the chapter ${chapterNumber(c)} checkpoint`,
    tier: "chapter",
    hue: LEVEL_HUES[c.level],
    label: String(chapterNumber(c)),
  })),
  ...LEVELS.filter((l) => CHAPTERS.some((c) => c.level === l.id)).map((l): Badge => ({
    id: `level:${l.id}`,
    title: `${l.name} finished`,
    detail: `Every ${l.id} chapter in the course`,
    tier: "level",
    hue: LEVEL_HUES[l.id],
    label: l.id,
  })),
  { id: "course", title: "Course finished", detail: "Every chapter, A1 to B2", tier: "course", hue: 75, icon: "star" },
  ...DAY_STREAKS.map((n): Badge => ({ id: `days:${n}`, title: `${n} days in a row`, detail: `Practiced ${n} days running`, tier: "milestone", hue: 25, icon: "flame" })),
  ...DRILL_STREAKS.map((n): Badge => ({ id: `drill:${n}`, title: `${n} right in a row`, detail: `A drill streak of ${n}`, tier: "milestone", hue: 325, icon: "bolt" })),
  ...MASTERED.map((n): Badge => ({
    id: `mastered:${n}`,
    title: `${plural(n, "item")} mastered`,
    detail: "Remembered for 21 days or more",
    tier: "milestone",
    hue: 160,
    label: n >= 1000 ? `${n / 1000}k` : String(n),
  })),
  {
    id: "comeback",
    title: "Comeback",
    detail: `A checkpoint retaken from under ${PASS_SCORE}% to ${COMEBACK_SCORE}% or more`,
    tier: "milestone",
    hue: 235,
    icon: "up",
  },
];

export const findBadge = (id: string) => BADGES.find((b) => b.id === id);

/** What badges are worked out from. Everything but the course is only known when signed in. */
export interface BadgeData {
  course: CourseProgress;
  /** Days practiced, as loaded for /progress. */
  days?: string[];
  mastered?: number;
  drillStreak?: StreakRecord | null;
}

function previousDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** For each run of days in a row, the day it reached `length`. Earliest first. */
function streakDays(days: string[], length: number): string[] {
  const practiced = new Set(days);
  const reached: string[] = [];
  for (const day of [...practiced].sort()) {
    // Only the day a run reaches the length counts, so a long run is one badge, not many.
    let run = 1;
    for (let d = previousDay(day); practiced.has(d) && run <= length; d = previousDay(d)) run++;
    if (run === length) reached.push(day);
  }
  return reached;
}

/**
 * Badges earned now, each with the day it was earned when the data says, or `today` when it doesn't, like a mastered
 * count. Callers keep the first day they saw each one, so these only fill in what's new.
 */
export function earnedBadges(data: BadgeData, today: string): Record<string, string> {
  const out: Record<string, string> = {};
  const { course } = data;
  for (const c of CHAPTERS) if (isDone(course, c.id)) out[`chapter:${c.id}`] = course[c.id].done!;

  const finishedOn = (chapters: typeof CHAPTERS) =>
    chapters.length > 0 && chapters.every((c) => isDone(course, c.id)) ? chapters.map((c) => course[c.id].done!).sort().at(-1)! : null;
  for (const l of LEVELS) {
    const day = finishedOn(CHAPTERS.filter((c) => c.level === l.id));
    if (day) out[`level:${l.id}`] = day;
  }
  const all = finishedOn(CHAPTERS);
  if (all) out.course = all;

  for (const n of DAY_STREAKS) {
    const day = streakDays(data.days ?? [], n)[0];
    if (day) out[`days:${n}`] = day;
  }
  for (const n of DRILL_STREAKS) if ((data.drillStreak?.streak ?? 0) >= n) out[`drill:${n}`] = data.drillStreak!.day;
  for (const n of MASTERED) if ((data.mastered ?? 0) >= n) out[`mastered:${n}`] = today;

  // The first passing try of 90%+ that came after a try under the pass mark.
  const comebacks = Object.values(course).flatMap((chapter) => {
    const tries = chapter.tries ?? [];
    const firstLow = tries.findIndex((t) => t.score < PASS_SCORE);
    const later = firstLow < 0 ? undefined : tries.slice(firstLow + 1).find((t) => t.score >= COMEBACK_SCORE);
    return later ? [later.day] : [];
  });
  if (comebacks.length > 0) out.comeback = comebacks.sort()[0];
  return out;
}

/** Saved days win, since a badge stays earned once seen: a streak ends, but the badge for it doesn't. */
export const withSaved = (earned: Record<string, string>, saved: Record<string, string>): Record<string, string> => ({ ...earned, ...saved });

/** A few unearned badges to aim for: the next chapter, streak and milestone of each kind. */
export function nextBadges(earned: Record<string, string>, count = 4): Badge[] {
  const open = BADGES.filter((b) => !earned[b.id]);
  const firstOf = (prefix: string) => open.find((b) => b.id.startsWith(prefix));
  return [firstOf("chapter:"), firstOf("level:"), firstOf("days:"), firstOf("drill:"), firstOf("mastered:"), firstOf("comeback")]
    .filter((b): b is Badge => !!b)
    .slice(0, count);
}

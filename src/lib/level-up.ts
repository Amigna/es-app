import type { TenseId } from "./conjugation/types";
import { LEVELS, levelInfo, type Level } from "./level";
import { accuracy, answered, type Tally } from "./progress";

// When to suggest the next level: about 85% right on the level's tenses across the latest few hundred answers. Recent
// answers only, so early mistakes don't hold anyone back, and every tense needs some, so one strong tense can't carry
// the rest. Accent slips count toward the answers but not the percentage, as everywhere on /progress.

export const READY_ANSWERS = 300;
export const READY_ACCURACY = 85;
export const MIN_PER_TENSE = 20;

export interface Readiness {
  next: Level;
  /** Answers in the level's tenses, newest days first, stopping once there are READY_ANSWERS. */
  answered: number;
  accuracy: number | null;
  /** The level's tenses with fewer than MIN_PER_TENSE of those answers. */
  thin: TenseId[];
  ready: boolean;
}

/** Null at the top level. `days` are saved days by date, which only have `tenses` from when that started being saved. */
export function levelReadiness(days: Record<string, { tenses?: Record<string, Tally> }>, level: Level): Readiness | null {
  const index = LEVELS.findIndex((l) => l.id === level);
  if (index === LEVELS.length - 1) return null;
  const tenses = levelInfo(level).tenses;
  const byTense = new Map<TenseId, Tally>(tenses.map((t) => [t, { right: 0, accent: 0, wrong: 0 }]));
  const total: Tally = { right: 0, accent: 0, wrong: 0 };
  // Whole days at a time, so the last day can take it a little past READY_ANSWERS.
  for (const day of Object.keys(days).sort().reverse()) {
    if (answered(total) >= READY_ANSWERS) break;
    for (const tense of tenses) {
      const t = days[day].tenses?.[tense];
      if (!t) continue;
      const sum = byTense.get(tense)!;
      for (const key of ["right", "accent", "wrong"] as const) {
        sum[key] += t[key];
        total[key] += t[key];
      }
    }
  }
  const pct = accuracy(total);
  const thin = tenses.filter((t) => answered(byTense.get(t)!) < MIN_PER_TENSE);
  return {
    next: LEVELS[index + 1].id,
    answered: answered(total),
    accuracy: pct,
    thin,
    ready: answered(total) >= READY_ANSWERS && pct !== null && pct >= READY_ACCURACY && thin.length === 0,
  };
}

/**
 * What to do on sign-in so this browser and the account agree: take the account's level, send this browser's, or
 * nothing. The newer wins. Levels saved before their time was kept have 0, so they lose to any dated one, and a tie
 * changes nothing.
 */
export function levelSync(local: { level: Level | null; at: number }, saved: { level: Level; at: number } | null): "take" | "send" | "none" {
  if (saved && (!local.level || saved.at > local.at)) return saved.level === local.level && saved.at === local.at ? "none" : "take";
  if (local.level && (!saved || local.at > saved.at) && local.level !== saved?.level) return "send";
  return "none";
}

/** A level change, saved with the day it happened. */
export interface LevelChange {
  level: Level;
  day: string;
}

const dayNumber = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

/** Level changes within the last `weeks` seven-day stretches, as how many weeks ago, matching recentWeeks. The latest per week wins. */
export function levelChangesByWeek(history: LevelChange[], today: string, weeks: number): { ago: number; level: Level }[] {
  const byWeek = new Map<number, LevelChange>();
  for (const change of history) {
    const ago = Math.floor((dayNumber(today) - dayNumber(change.day)) / 7);
    if (ago < 0 || ago >= weeks) continue;
    const kept = byWeek.get(ago);
    if (!kept || change.day >= kept.day) byWeek.set(ago, change);
  }
  return [...byWeek].map(([ago, change]) => ({ ago, level: change.level })).sort((a, b) => b.ago - a.ago);
}

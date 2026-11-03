import type { Grade } from "./drill";
import { firstMemory, intervalDays, nextMemory, type Memory, type Rating } from "./fsrs";
import { localDay, type Answer } from "./progress";

// Turns answers into review dates. No Firebase here, so it's safe to load anywhere.

export interface Schedule extends Memory {
  /** The day this item is next due. */
  due: string;
  /** The day it was last reviewed. */
  last: string;
}

export const REVIEWS_PER_DAY = 100;
export const DEFAULT_NEW_PER_DAY = 10;
export const NEW_PER_DAY_OPTIONS = [5, 10, 20];
/** Stability at which an item counts as mastered: expected to stick for three weeks. */
export const MASTERED_DAYS = 21;

const RATINGS: Record<Grade, Rating> = { wrong: 1, accent: 2, correct: 3 };

/** Guide quizzes stay out: their IDs are question positions, which shift when a quiz is edited. */
export const schedulable = (item: string) => item.startsWith("verb:") || item.startsWith("vocab:");

const toUtc = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / 86_400_000);

export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d + days));
}

export function reviewItem(previous: Schedule | undefined, grade: Grade, day: string): Schedule {
  const rating = RATINGS[grade];
  const memory = previous ? nextMemory(previous, rating, daysBetween(previous.last, day)) : firstMemory(rating);
  return { ...memory, due: addDays(day, intervalDays(memory.stability)), last: day };
}

export interface ReviewPlan {
  /** What changed, by item. */
  schedules: Record<string, Schedule>;
  /** Items seen for the first time. */
  fresh: string[];
  perDay: Record<string, { newItems: number; reviews: number }>;
}

/**
 * Only the first answer to an item each day moves its schedule, matching "only the first try counts". It also means
 * a batch sent twice can't move a schedule twice.
 */
export function planReviews(answers: Answer[], stored: Record<string, Schedule>): ReviewPlan {
  const plan: ReviewPlan = { schedules: {}, fresh: [], perDay: {} };
  for (const { item, grade, day } of answers) {
    if (!schedulable(item)) continue;
    const previous = plan.schedules[item] ?? stored[item];
    if (previous && day <= previous.last) continue;
    plan.schedules[item] = reviewItem(previous, grade, day);
    if (!previous) plan.fresh.push(item);
    (plan.perDay[day] ??= { newItems: 0, reviews: 0 })[previous ? "reviews" : "newItems"]++;
  }
  return plan;
}

export interface TodayData {
  /** Due items, most overdue first. */
  due: string[];
  /** Every item that has a schedule. */
  seen: string[];
  newDone: number;
  reviewsDone: number;
  newPerDay: number;
  /** Items the learner asked for, like a word tapped while reading. They come first among new items. */
  wanted: string[];
}

/**
 * Wanted items still count toward the new-item limit, because they add the same review load. Only items in the usual
 * order are taken, which leaves out rare tenses and words no longer in the data.
 */
export function pickToday({ due, seen, newDone, reviewsDone, newPerDay, wanted }: TodayData, order: string[]) {
  const started = new Set(seen);
  const known = new Set(order);
  const queue = [...new Set([...wanted.filter((item) => known.has(item)), ...order])];
  return {
    reviews: due.slice(0, Math.max(0, REVIEWS_PER_DAY - reviewsDone)),
    fresh: queue.filter((item) => !started.has(item)).slice(0, Math.max(0, newPerDay - newDone)),
  };
}

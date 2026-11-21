import type { Grade } from "./drill";
import { firstMemory, intervalDays, nextMemory, type Memory, type Rating } from "./fsrs";
import { localDay, type Answer, type Tally } from "./progress";

// Turns answers into review dates. No Firebase here, so it's safe to load anywhere.

export interface Schedule extends Memory {
  /** The day this item is next due. */
  due: string;
  /** The day it was last reviewed. */
  last: string;
}

export const DEFAULT_REVIEWS_PER_DAY = 50;
export const REVIEWS_PER_DAY_OPTIONS = [25, 50, 100];
/** The most reviews any setting allows. Today's review loads one more due item than this, to tell when more are due than a day can clear. */
export const MAX_REVIEWS_PER_DAY = Math.max(...REVIEWS_PER_DAY_OPTIONS);
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
  /**
   * Counts toward the daily limits, by day. `recall` is how the reviews of items that had come due went: whether they'd
   * stuck. An item practiced before its due day counts as a review but not toward `recall`, since it wasn't a test of
   * memory at the interval the schedule chose. `mastered` is how many items crossed MASTERED_DAYS that day, up minus
   * down, so /progress can show the mastered count over time. Stability only changes when an item is reviewed, so these
   * add up to the exact change in the mastered count.
   */
  perDay: Record<string, { newItems: number; reviews: number; recall: Tally; mastered: number }>;
}

const isMastered = (schedule: Schedule | undefined) => (schedule?.stability ?? 0) >= MASTERED_DAYS;

const RECALL_FIELD: Record<Grade, keyof Tally> = { correct: "right", accent: "accent", wrong: "wrong" };

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
    const next = reviewItem(previous, grade, day);
    plan.schedules[item] = next;
    if (!previous) plan.fresh.push(item);
    const counts = (plan.perDay[day] ??= { newItems: 0, reviews: 0, recall: { right: 0, accent: 0, wrong: 0 }, mastered: 0 });
    counts[previous ? "reviews" : "newItems"]++;
    if (previous && day >= previous.due) counts.recall[RECALL_FIELD[grade]]++;
    if (isMastered(next) !== isMastered(previous)) counts.mastered += isMastered(next) ? 1 : -1;
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
  reviewsPerDay: number;
  newPerDay: number;
  /** Items the learner asked for, like a word tapped while reading. They come first among new items. */
  wanted: string[];
  /** Stability in days of the due items, read with them. Missing for an item means it's treated as not yet learned. */
  stability?: Record<string, number>;
}

/**
 * Due verb tenses this well learned are asked from the verb's meaning in Today's review, so recalling the verb is part
 * of the test once the form itself is easy. New and shaky ones keep showing the infinitive.
 */
export const RECALL_STABILITY = MASTERED_DAYS;

/** How many more reviews today's limit allows. */
export const reviewsLeft = (reviewsPerDay: number, reviewsDone: number) => Math.max(0, reviewsPerDay - reviewsDone);

/**
 * Wanted items still count toward the new-item limit, because they add the same review load. Only items in the usual
 * order are taken, which leaves out rare tenses and words no longer in the data.
 *
 * New items are paused while more is due than today's review limit can clear. Each new item asks for several reviews
 * over its first weeks, so otherwise the overdue pile can grow faster than the limit clears it. Paused, the pile
 * shrinks by a day's limit each day, and new items come back once it fits. Wanted items wait too, still first in line.
 * `due` must hold at least one more item than `reviewsPerDay` when that many are due, so the pause can be told apart
 * from a day that's exactly full.
 */
export function pickToday({ due, seen, newDone, reviewsDone, reviewsPerDay, newPerDay, wanted, stability = {} }: TodayData, order: string[]) {
  const started = new Set(seen);
  const known = new Set(order);
  const queue = [...new Set([...wanted.filter((item) => known.has(item)), ...order])];
  const left = reviewsLeft(reviewsPerDay, reviewsDone);
  const paused = due.length > left;
  const reviews = due.slice(0, left);
  return {
    reviews,
    fresh: paused ? [] : queue.filter((item) => !started.has(item)).slice(0, Math.max(0, newPerDay - newDone)),
    paused,
    /** Reviews to ask from the verb's meaning: verb tenses at RECALL_STABILITY or more. */
    recall: reviews.filter((item) => item.startsWith("verb:") && (stability[item] ?? 0) >= RECALL_STABILITY),
  };
}

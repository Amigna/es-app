import { TENSES } from "./conjugation/types";
import { accuracy, answered, type Tally } from "./progress";
import { schedulable } from "./schedule";

// Notices what keeps going wrong, so the app can say so and offer practice. No Firebase here, so it's safe to load anywhere.
//
// "Missed" means answered wrong on a first try, the same answers /progress counts. Accent slips aren't misses.
// A word's item is one word and one question type, so its count is exact. A verb's item covers a tense's five forms,
// so its count is for the verb in that tense. Writing and dictation share one item per direction across all sentences,
// so they're left out (`schedulable` already skips them).

/** A word, or a verb in one tense: at least this many misses and under this share right. */
export const ITEM_MIN_MISSES = 3;
export const ITEM_BELOW = 60;
/** A whole verb, all tenses: enough answers that it isn't one bad day, and clearly worse than a weak spot. */
export const VERB_MIN_ANSWERS = 10;
export const VERB_MIN_MISSES = 5;
export const VERB_BELOW = 70;

/**
 * Items kept on the saved watch list (`stats/struggling`). Looser than the nudge, so a drill knows the count of an item
 * one miss away from a nudge, and the list stays small because items leave it as they improve.
 */
const WATCH_MIN_MISSES = 2;
const WATCH_BELOW = 75;

const below = (t: Tally, minMisses: number, under: number) => t.wrong >= minMisses && (accuracy(t) ?? 100) < under;

export const isStruggling = (t: Tally) => below(t, ITEM_MIN_MISSES, ITEM_BELOW);
export const watched = (t: Tally) => below(t, WATCH_MIN_MISSES, WATCH_BELOW);
export const verbStruggling = (t: Tally) => answered(t) >= VERB_MIN_ANSWERS && below(t, VERB_MIN_MISSES, VERB_BELOW);

export const addTally = (a: Tally | undefined, b: Tally | undefined): Tally => ({
  right: (a?.right ?? 0) + (b?.right ?? 0),
  accent: (a?.accent ?? 0) + (b?.accent ?? 0),
  wrong: (a?.wrong ?? 0) + (b?.wrong ?? 0),
});

/**
 * Changes to the watch list after a save: each item's new all-time totals when it's watched, or null to take it off.
 * `stored` is the item's totals before this batch, read anyway for its schedule, so this needs no extra read. An item
 * that wasn't watched before and still isn't changes nothing, so most saves leave the list alone.
 */
export function watchUpdate(stored: Record<string, Tally>, batch: Record<string, Tally>): Record<string, Tally | null> {
  const out: Record<string, Tally | null> = {};
  for (const [id, added] of Object.entries(batch)) {
    if (!schedulable(id)) continue;
    const before = stored[id];
    const now = addTally(before, added);
    if (watched(now)) out[id] = { right: now.right, accent: now.accent, wrong: now.wrong };
    else if (before && watched(before)) out[id] = null;
  }
  return out;
}

export interface Struggle {
  item: string;
  tally: Tally;
}

/** Most misses first, then the lowest share right. */
export function itemStruggles(items: Record<string, Tally>): Struggle[] {
  return Object.entries(items)
    .filter(([item, tally]) => schedulable(item) && isStruggling(tally))
    .map(([item, tally]) => ({ item, tally }))
    .sort((a, b) => b.tally.wrong - a.tally.wrong || (accuracy(a.tally) ?? 0) - (accuracy(b.tally) ?? 0));
}

/** Verbs by infinitive, lowest share right first. */
export function verbStruggles(verbs: Record<string, Tally>): { verb: string; tally: Tally }[] {
  return Object.entries(verbs)
    .filter(([, tally]) => verbStruggling(tally))
    .map(([verb, tally]) => ({ verb, tally }))
    .sort((a, b) => (accuracy(a.tally) ?? 0) - (accuracy(b.tally) ?? 0) || b.tally.wrong - a.tally.wrong);
}

/** The verb an item is about, if it's a verb item. */
export const itemVerb = (item: string) => (item.startsWith("verb:") ? item.split(":")[1] : null);

/**
 * What an item is, in words that fit "You've missed … 4 times": "tener in the preterite", "the gender of casa".
 * Items are verb:tener:preterite or vocab:noun:casa:gender. Words and phrases never contain a colon.
 */
export function describeItem(item: string): string {
  const [source, first, second, third] = item.split(":");
  if (source === "verb") {
    const tense = TENSES.find((t) => t.id === second);
    return tense ? `${first} in the ${tense.name.toLowerCase()}` : first;
  }
  const word = second;
  if (third === "gender") return `the gender of ${word}`;
  if (third === "agreement") return `the endings of ${word}`;
  if (third === "toEnglish") return `what ${word} means`;
  if (third === "toSpanish") return `${word} (English to Spanish)`;
  return word ?? item;
}

export const timesText = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/** Answers this session, first tries only, as saved. Totals add these to the saved ones loaded when the drill started. */
export function sessionTotals(saved: Record<string, Tally>, session: Record<string, Tally>): Record<string, Tally> {
  const out: Record<string, Tally> = { ...saved };
  for (const [id, t] of Object.entries(session)) out[id] = addTally(saved[id], t);
  return out;
}

/** The line under a missed answer, given the item's totals including this miss. Null when it isn't a struggle yet. */
export function missNudge(item: string, total: Tally): string | null {
  if (!schedulable(item) || !isStruggling(total)) return null;
  const what = item.startsWith("verb:") ? describeItem(item) : "this";
  return `You've missed ${what} ${timesText(total.wrong)}. There's a practice link at the end.`;
}

/**
 * What the results screen lists: only verbs and items practiced in this drill, with totals that include it. `saved`
 * is what was loaded when the drill started, before any of this drill's answers were saved, so nothing counts twice.
 */
export function drillStruggles(
  saved: { items: Record<string, Tally>; verbs: Record<string, Tally> },
  session: Record<string, Tally>,
  limits: { verbs: number; items: number },
) {
  const sessionVerbs: Record<string, Tally> = {};
  for (const [id, t] of Object.entries(session)) {
    const verb = itemVerb(id);
    if (verb) sessionVerbs[verb] = addTally(sessionVerbs[verb], t);
  }
  const verbTotals = Object.fromEntries(Object.entries(sessionVerbs).map(([v, t]) => [v, addTally(saved.verbs[v], t)]));
  const totals = sessionTotals(saved.items, session);
  const practiced = Object.fromEntries(Object.keys(session).map((id) => [id, totals[id]]));
  return { verbs: verbStruggles(verbTotals).slice(0, limits.verbs), items: itemStruggles(practiced).slice(0, limits.items) };
}

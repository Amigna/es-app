import { useSyncExternalStore } from "react";
import { TENSES, type TenseId } from "./conjugation/types";
import type { VerbPool } from "./drill";
import { progressEnabled } from "./progress-queue";

// How much Spanish someone knows, which sets the drill's starting tenses and verbs. It's a starting point, not a lock:
// any tense or verb can still be picked by hand. Kept in this browser, and in Firestore for signed-in people.

export type Level = "A1" | "A2" | "B1" | "B2";

export interface LevelInfo {
  id: Level;
  name: string;
  /** How someone would describe themselves, for the question. */
  hint: string;
  tenses: TenseId[];
  /** How many of the most common verbs the "Most common" choice covers. */
  commonVerbs: number;
  pool: VerbPool;
}

/** Each level adds to the one before, in the order most courses teach the tenses. */
export const LEVELS: LevelInfo[] = [
  { id: "A1", name: "Beginner", hint: "New to Spanish, or know a few words", tenses: ["present"], commonVerbs: 25, pool: "common" },
  {
    id: "A2",
    name: "Elementary",
    hint: "Can talk about everyday things and the past a little",
    tenses: ["present", "preterite", "imperfect"],
    // The home page's essential verbs, ESSENTIAL_COUNT in verbs.ts. Not imported, to keep the verb list out of this file's bundle.
    commonVerbs: 135,
    pool: "common",
  },
  {
    id: "B1",
    name: "Intermediate",
    hint: "Comfortable with the past, starting the subjunctive",
    // Commands are B1 in the course, so the drill follows.
    tenses: ["present", "preterite", "imperfect", "presentPerfect", "future", "conditional", "subjPresent", "impAffirmative", "impNegative"],
    commonVerbs: 300,
    pool: "common",
  },
  { id: "B2", name: "Advanced", hint: "Know most tenses and want everything", tenses: TENSES.map((t) => t.id), commonVerbs: 300, pool: "all" },
];

const IDS = LEVELS.map((l) => l.id);

export const isLevel = (value: unknown): value is Level => IDS.includes(value as Level);

export const levelInfo = (level: Level): LevelInfo => LEVELS.find((l) => l.id === level) ?? LEVELS[0];

const KEY = "level";
// When it was chosen, so the newer of this browser's level and the account's wins on sign-in.
const AT_KEY = "level-at";
const listeners = new Set<() => void>();
// Still works for the visit when storage is blocked.
let memory: string | null = null;
let memoryAt = 0;

function read(): Level | null {
  let raw = memory;
  try {
    raw = localStorage.getItem(KEY) ?? memory;
  } catch {
    // Blocked storage falls back to this visit's copy.
  }
  return isLevel(raw) ? raw : null;
}

/** When this browser's level was chosen, in milliseconds. 0 when unknown, as for levels saved before this was kept. */
export function storedLevelAt(): number {
  try {
    return Number(localStorage.getItem(AT_KEY)) || memoryAt;
  } catch {
    return memoryAt;
  }
}

/** Only this browser. `chooseLevel` also saves it to the account. */
export function storeLevel(level: Level, at = Date.now()) {
  memory = level;
  memoryAt = at;
  try {
    localStorage.setItem(KEY, level);
    localStorage.setItem(AT_KEY, String(at));
  } catch {
    // Private windows can refuse storage; the in-memory copy covers this visit.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const storedLevel = read;

/** Null until a level is chosen, and on the server. */
export function useLevel(): Level | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** Saves the level here and, when signed in, to the account. Firebase is only loaded for signed-in people. */
export async function chooseLevel(level: Level) {
  const at = Date.now();
  storeLevel(level, at);
  if (!progressEnabled()) return;
  const { saveLevel } = await import("./progress-store");
  await saveLevel(level, at);
}

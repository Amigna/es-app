import { useCallback, useMemo, useSyncExternalStore } from "react";
import { TENSES, type TenseId } from "./conjugation/types";
import type { VerbPool } from "./drill";

export type Mode = "review" | "conjugation" | "vocabulary" | "flashcards" | "writing" | "blanks" | "grammar";
export type VocabKind = "toSpanish" | "toEnglish" | "gender" | "agreement";
export type WordType = "noun" | "adjective" | "adverb" | "small";
/** Phrases are flashcards only: typing a whole sentence exactly is a test of punctuation more than memory. */
export type CardType = WordType | "phrase";
export type FlashSide = "toEnglish" | "toSpanish";

/** Listed here so the setup screen doesn't have to load the word lists. A test keeps this in step with the data. */
export const NOUN_TOPICS = ["body", "clothes", "family", "food", "home", "nature", "people", "places", "things", "time", "travel", "work"];

export interface DrillSettings {
  mode: Mode;
  pool: VerbPool;
  tenses: TenseId[];
  kinds: VocabKind[];
  wordTypes: WordType[];
  /** Empty means every topic. */
  topics: string[];
  /** Guide slugs for the grammar drill; empty means every guide. */
  guides: string[];
  /** Which way flashcards are asked. */
  flashSide: FlashSide;
  flashTypes: CardType[];
  /** Which ways sentences are translated in the writing drill. */
  writingSides: FlashSide[];
}

export const DEFAULT_SETTINGS: DrillSettings = {
  mode: "conjugation",
  pool: "common",
  tenses: ["present", "preterite", "imperfect"],
  kinds: ["toSpanish", "gender"],
  wordTypes: ["noun", "adjective", "adverb", "small"],
  topics: [],
  guides: [],
  flashSide: "toEnglish",
  flashTypes: ["noun", "adjective", "adverb", "small", "phrase"],
  writingSides: ["toEnglish", "toSpanish"],
};

const MODES: Mode[] = ["review", "conjugation", "vocabulary", "flashcards", "writing", "blanks", "grammar"];
const POOLS: VerbPool[] = ["common", "irregular", "all"];
const KINDS: VocabKind[] = ["toSpanish", "toEnglish", "gender", "agreement"];
const WORD_TYPES: WordType[] = ["noun", "adjective", "adverb", "small"];
const FLASH_SIDES: FlashSide[] = ["toEnglish", "toSpanish"];
const CARD_TYPES: CardType[] = [...WORD_TYPES, "phrase"];
const TENSE_IDS = TENSES.map((t) => t.id);

const oneOf = <T,>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const someOf = <T,>(value: unknown, allowed: readonly T[], fallback: T[]): T[] =>
  Array.isArray(value) ? allowed.filter((a) => value.includes(a)) : fallback;

/** Saved data can be old or hand-edited, so anything unrecognized falls back to the default. */
export function parseSettings(raw: string | null): DrillSettings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const saved = JSON.parse(raw) as Partial<Record<keyof DrillSettings, unknown>>;
    return {
      mode: oneOf(saved.mode, MODES, DEFAULT_SETTINGS.mode),
      pool: oneOf(saved.pool, POOLS, DEFAULT_SETTINGS.pool),
      tenses: someOf(saved.tenses, TENSE_IDS, DEFAULT_SETTINGS.tenses),
      kinds: someOf(saved.kinds, KINDS, DEFAULT_SETTINGS.kinds),
      wordTypes: someOf(saved.wordTypes, WORD_TYPES, DEFAULT_SETTINGS.wordTypes),
      topics: someOf(saved.topics, NOUN_TOPICS, DEFAULT_SETTINGS.topics),
      guides: Array.isArray(saved.guides) ? saved.guides.filter((g) => typeof g === "string") : DEFAULT_SETTINGS.guides,
      flashSide: oneOf(saved.flashSide, FLASH_SIDES, DEFAULT_SETTINGS.flashSide),
      flashTypes: someOf(saved.flashTypes, CARD_TYPES, DEFAULT_SETTINGS.flashTypes),
      writingSides: someOf(saved.writingSides, FLASH_SIDES, DEFAULT_SETTINGS.writingSides),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const KEY = "drill-settings";
const listeners = new Set<() => void>();
// Settings still work for the visit when storage is blocked.
let memory: string | null = null;

function read(): string | null {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function write(value: string) {
  memory = value;
  try {
    localStorage.setItem(KEY, value);
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

/** Reads localStorage without a hydration mismatch: the server renders defaults, then saved values take over. */
export function useDrillSettings(): [DrillSettings, (patch: Partial<DrillSettings>) => void] {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const settings = useMemo(() => parseSettings(raw), [raw]);
  const update = useCallback(
    (patch: Partial<DrillSettings>) => write(JSON.stringify({ ...parseSettings(read()), ...patch })),
    [],
  );
  return [settings, update];
}

import { useSyncExternalStore } from "react";
import { MAX_TRIES, PASS_SCORE, STEP_IDS, mergeCourse, parseCourse, sameCourse, type ChapterProgress, type CourseProgress, type StepId } from "./course";
import { localDay } from "./progress";
import { progressEnabled } from "./progress-queue";

// This browser's copy, read with useSyncExternalStore like the level and drill settings.

const KEY = "course-progress";
const EMPTY: CourseProgress = {};
const listeners = new Set<() => void>();
// Still works for the visit when storage is blocked.
let memory: string | null = null;
let cached: { raw: string | null; value: CourseProgress } = { raw: null, value: EMPTY };

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

/** The same object until the stored text changes, as useSyncExternalStore needs. */
function read(): CourseProgress {
  const raw = readRaw();
  if (raw !== cached.raw) {
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      // Unreadable data starts over.
    }
    cached = { raw, value: parseCourse(parsed) };
  }
  return cached.value;
}

function store(progress: CourseProgress) {
  const raw = Object.keys(progress).length > 0 ? JSON.stringify(progress) : null;
  memory = raw;
  try {
    if (raw) localStorage.setItem(KEY, raw);
    else localStorage.removeItem(KEY);
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

export const storedCourse = read;

/** Empty on the server and before anything is saved. */
export function useCourseProgress(): CourseProgress {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

let syncing: Promise<void> | null = null;

/**
 * Merges this browser's copy into the account and keeps the result here too, so progress made signed out moves to the
 * account. Firebase is only loaded for signed-in people. A failure keeps the local copy, and the next sync catches up.
 */
export function syncCourse(): Promise<void> {
  if (!progressEnabled()) return Promise.resolve();
  syncing ??= import("./progress-store")
    .then(({ saveCourse }) => saveCourse(read()))
    .then((merged) => {
      // Signed out while saving: the cleared copy stays cleared.
      if (!progressEnabled()) return;
      // Anything finished during the save is merged back in, not overwritten.
      const combined = mergeCourse(read(), merged);
      if (!sameCourse(combined, read())) store(combined);
    })
    .catch((err) => console.error("Couldn't save course progress", err))
    .finally(() => {
      syncing = null;
    });
  return syncing;
}

function change(id: string, update: (chapter: ChapterProgress) => ChapterProgress) {
  const progress = read();
  store({ ...progress, [id]: { ...update(progress[id] ?? { steps: [] }), at: Date.now() } });
  // A save already under way read the copy before this change, so this one waits its turn.
  void (syncing ?? Promise.resolve()).then(syncCourse);
}

export function completeStep(id: string, step: Exclude<StepId, "checkpoint">) {
  change(id, (chapter) => (chapter.steps.includes(step) ? chapter : { ...chapter, steps: STEP_IDS.filter((s) => s === step || chapter.steps.includes(s)) }));
}

/** Saves a checkpoint try. Passing finishes the chapter. */
export function recordCheckpoint(id: string, score: number) {
  change(id, (chapter) => {
    const passed = score >= PASS_SCORE;
    const out: ChapterProgress = {
      ...chapter,
      best: Math.max(chapter.best ?? 0, score),
      tries: [...(chapter.tries ?? []), { day: localDay(), score }].slice(-MAX_TRIES),
    };
    if (passed) {
      out.steps = STEP_IDS.filter((s) => s === "checkpoint" || chapter.steps.includes(s));
      out.done = chapter.done ?? localDay();
    }
    return out;
  });
}

/** On sign-out, so the next person on this browser doesn't start with someone else's chapters. */
export function clearCourse() {
  store({});
}

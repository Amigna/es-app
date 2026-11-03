import type { Grade } from "./drill";
import { localDay, type Answer, type Track } from "./progress";

// Holds answers until they're saved. Firebase is only imported at save time, and only for invited
// people, so signed-out visitors never download it.

const ENABLED_KEY = "progress-enabled";
const QUEUE_KEY = "progress-queue";
const SAVE_EVERY = 10;
const MAX_QUEUED = 500;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Blocked storage only means answers aren't kept across visits.
  }
}

let queue: Answer[] | null = null;
let listening = false;

function pending(): Answer[] {
  if (!queue) {
    try {
      queue = JSON.parse(read(QUEUE_KEY) ?? "[]") as Answer[];
    } catch {
      queue = [];
    }
  }
  return queue;
}

function keep(answers: Answer[]) {
  queue = answers.slice(-MAX_QUEUED);
  write(QUEUE_KEY, queue.length ? JSON.stringify(queue) : null);
}

/** Set once someone's invite is confirmed, and cleared when they sign out. */
export function setProgressEnabled(on: boolean) {
  write(ENABLED_KEY, on ? "1" : null);
  if (!on) keep([]);
}

/** Whether this person is signed in and invited, as far as this browser knows. */
export const progressEnabled = () => read(ENABLED_KEY) === "1";

type Save = (answers: Answer[]) => Promise<void>;

const saveToFirestore: Save = async (answers) => {
  const { saveAnswers } = await import("./progress-store");
  await saveAnswers(answers);
};

async function flush(save: Save) {
  const batch = pending();
  if (batch.length === 0 || !progressEnabled()) return;
  try {
    await save(batch);
    keep(pending().slice(batch.length));
  } catch (err) {
    console.error("Couldn't save progress", err);
  }
}

let saving: Promise<void> | null = null;

/** Answers stay queued until the write is confirmed, so a closed tab can't lose them. Calls during a save join it. */
export function saveProgress(save: Save = saveToFirestore): Promise<void> {
  saving ??= flush(save).finally(() => {
    saving = null;
  });
  return saving;
}

export function recordAnswer(track: Track, grade: Grade, mistake?: Answer["mistake"]) {
  if (!progressEnabled()) return;
  if (!listening && typeof document !== "undefined") {
    listening = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveProgress();
    });
  }
  keep([...pending(), { ...track, grade, day: localDay(), ...(mistake && grade !== "correct" ? { mistake } : {}) }]);
  if (pending().length >= SAVE_EVERY) saveProgress();
}

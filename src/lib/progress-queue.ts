import type { Grade } from "./drill";
import { localDay, type Answer, type StreakRecord, type Track } from "./progress";

// Holds answers until they're saved. Firebase is only imported at save time, and only for signed-in
// people, so signed-out visitors never download it.

const ENABLED_KEY = "progress-enabled";
const QUEUE_KEY = "progress-queue";
const STREAK_KEY = "progress-best-streak";
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

/** The best drill streak since the last save, or null when there's nothing new to send. */
function queuedStreak(): StreakRecord | null {
  try {
    return JSON.parse(read(STREAK_KEY) ?? "null") as StreakRecord | null;
  } catch {
    return null;
  }
}

/** Set when someone signs in, and cleared when they sign out. */
export function setProgressEnabled(on: boolean) {
  write(ENABLED_KEY, on ? "1" : null);
  if (!on) {
    keep([]);
    write(STREAK_KEY, null);
  }
}

/** Whether this person is signed in, as far as this browser knows. */
export const progressEnabled = () => read(ENABLED_KEY) === "1";

type Save = (answers: Answer[], best: StreakRecord | null) => Promise<void>;

const saveToFirestore: Save = async (answers, best) => {
  const { saveAnswers, saveBestStreak } = await import("./progress-store");
  // The streak goes first: saving it twice does no harm, but answers re-sent after a failure would count twice.
  if (best) await saveBestStreak(best);
  if (answers.length > 0) await saveAnswers(answers);
};

async function flush(save: Save) {
  const batch = pending();
  const best = queuedStreak();
  if ((batch.length === 0 && !best) || !progressEnabled()) return;
  try {
    await save(batch, best);
    keep(pending().slice(batch.length));
    // A longer streak reached during the save stays queued for the next one.
    if (best && queuedStreak()?.streak === best.streak) write(STREAK_KEY, null);
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

/**
 * Called with each streak a drill reaches. Only a new high since the last save is kept, and it's sent with the next
 * save, where the higher of it and the saved record wins.
 */
export function recordStreak(streak: number) {
  if (!progressEnabled() || streak <= (queuedStreak()?.streak ?? 0)) return;
  write(STREAK_KEY, JSON.stringify({ streak, day: localDay() } satisfies StreakRecord));
}

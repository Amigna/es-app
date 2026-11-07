import type { Grade } from "./drill";
import { localDay, type Answer, type RunningStreak, type Track } from "./progress";

// Holds answers until they're saved. Firebase is only imported at save time, and only for signed-in
// people, so signed-out visitors never download it.

const ENABLED_KEY = "progress-enabled";
const QUEUE_KEY = "progress-queue";
const STREAK_KEY = "progress-drill-streak";
// Held one drill's best before streaks carried from drill to drill.
const OLD_STREAK_KEY = "progress-best-streak";
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

/** This browser's copy of the running streak. `unsaved` until a save has sent it. */
type LocalStreak = RunningStreak & { unsaved: boolean };

function localStreak(): LocalStreak | null {
  try {
    return JSON.parse(read(STREAK_KEY) ?? "null") as LocalStreak | null;
  } catch {
    return null;
  }
}

function keepStreak(streak: LocalStreak | null) {
  write(STREAK_KEY, streak ? JSON.stringify(streak) : null);
  write(OLD_STREAK_KEY, null);
}

const running = ({ day, streak, best, at }: LocalStreak): RunningStreak => ({ day, streak, best, at });

/** Set when someone signs in, and cleared when they sign out. */
export function setProgressEnabled(on: boolean) {
  write(ENABLED_KEY, on ? "1" : null);
  if (!on) {
    keep([]);
    keepStreak(null);
  }
}

/** Whether this person is signed in, as far as this browser knows. */
export const progressEnabled = () => read(ENABLED_KEY) === "1";

type Save = (answers: Answer[], streak: RunningStreak | null) => Promise<void>;

const saveToFirestore: Save = async (answers, streak) => {
  const { saveAnswers, saveDrillStreak } = await import("./progress-store");
  // The streak goes first: saving it twice does no harm, but answers re-sent after a failure would count twice.
  if (streak) await saveDrillStreak(streak);
  if (answers.length > 0) await saveAnswers(answers);
};

async function flush(save: Save) {
  const batch = pending();
  const local = localStreak();
  const streak = local?.unsaved ? running(local) : null;
  if ((batch.length === 0 && !streak) || !progressEnabled()) return;
  try {
    await save(batch, streak);
    keep(pending().slice(batch.length));
    // A streak that moved on during the save stays unsaved for the next one.
    const now = localStreak();
    if (streak && now?.at === streak.at) keepStreak({ ...now, unsaved: false });
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

/** The streak a drill starts from: where today's left off, or 0 on a new day or when signed out. */
export function drillStreak(): number {
  const local = localStreak();
  return progressEnabled() && local?.day === localDay() ? local.streak : 0;
}

/**
 * Called with the streak after each answer that changes it, a miss included. It's sent with the next save, where the
 * day's best and the all-time record keep the higher number.
 */
export function recordStreak(streak: number) {
  if (!progressEnabled()) return;
  const day = localDay();
  const local = localStreak();
  const best = local?.day === day ? Math.max(local.best, streak) : streak;
  keepStreak({ day, streak, best, at: Date.now(), unsaved: true });
}

type Load = () => Promise<RunningStreak | null>;

const loadFromFirestore: Load = async () => (await import("./progress-store")).loadDrillStreak();

/**
 * Picks up a streak carried on another device, when it's from today and newer than this browser's, and returns the
 * streak to start from. This browser's unsaved changes are sent first, so neither copy's best is lost.
 */
export async function syncDrillStreak(load: Load = loadFromFirestore, save: Save = saveToFirestore): Promise<number> {
  if (!progressEnabled()) return 0;
  await saveProgress(save);
  try {
    const saved = await load();
    const local = localStreak();
    if (saved && saved.day === localDay() && saved.at > (local?.at ?? 0)) keepStreak({ ...saved, unsaved: false });
  } catch (err) {
    console.error("Couldn't load the drill streak", err);
  }
  return drillStreak();
}

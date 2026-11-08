import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  documentId,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { mergeCourse, parseCourse, sameCourse, type CourseProgress } from "./course";
import { auth, db } from "./firebase";
import { isLevel, type Level } from "./level";
import type { LevelChange } from "./level-up";
import { localDay, summarize, type Answer, type DayTally, type Mistake, type RunningStreak, type StreakRecord, type Summary, type Tally } from "./progress";
import {
  DEFAULT_NEW_PER_DAY,
  DEFAULT_REVIEWS_PER_DAY,
  MASTERED_DAYS,
  MAX_REVIEWS_PER_DAY,
  planReviews,
  schedulable,
  type Schedule,
  type TodayData,
} from "./schedule";

// Everything lives under users/{uid}: `items` per thing practiced, `days` per calendar day, and `stats` for the
// summary, the list of scheduled items, settings and personal records. Pages read those instead of scanning items.

export const DAYS_TO_LOAD = 120;

const bump = (t: Tally) => ({ right: increment(t.right), accent: increment(t.accent), wrong: increment(t.wrong) });

const itemDoc = (uid: string, id: string) => doc(db(), "users", uid, "items", id);
const statsDoc = (uid: string, id: string) => doc(db(), "users", uid, "stats", id);

async function currentUid(): Promise<string | null> {
  await auth().authStateReady();
  return auth().currentUser?.uid ?? null;
}

/** The schedules saved so far. A next review depends on the last one, so these have to be read before writing. */
async function storedSchedules(uid: string, ids: string[]): Promise<Record<string, Schedule>> {
  const snapshots = await Promise.all(ids.map((id) => getDoc(itemDoc(uid, id))));
  const stored: Record<string, Schedule> = {};
  for (const snapshot of snapshots) {
    const data = snapshot.data();
    // Items answered before scheduling existed have tallies only, and start fresh here.
    if (data?.stability) stored[snapshot.id] = { stability: data.stability, difficulty: data.difficulty, due: data.due, last: data.last };
  }
  return stored;
}

export async function saveAnswers(answers: Answer[]) {
  const uid = await currentUid();
  // Throwing keeps the answers queued for when they're signed in again.
  if (!uid) throw new Error("Not signed in");

  const summary = summarize(answers);
  const { items, days } = summary;
  const plan = planReviews(answers, await storedSchedules(uid, Object.keys(items).filter(schedulable)));

  const batch = writeBatch(db());
  for (const [id, item] of Object.entries(items)) {
    batch.set(itemDoc(uid, id), { ...bump(item), ...plan.schedules[id], last: item.last }, { merge: true });
  }
  for (const [day, tally] of Object.entries(days)) {
    const counts = plan.perDay[day];
    const scheduled = counts ? { newItems: increment(counts.newItems), reviews: increment(counts.reviews) } : {};
    const byKind = (name: "tenses" | "writing" | "listening", kinds: Record<string, Tally> | undefined) =>
      kinds ? { [name]: Object.fromEntries(Object.entries(kinds).map(([kind, t]) => [kind, bump(t)])) } : {};
    // A re-sent batch adds the same mistakes, and arrayUnion skips exact copies.
    const missed = summary.mistakes[day] ? { mistakes: arrayUnion(...summary.mistakes[day]) } : {};
    batch.set(
      doc(db(), "users", uid, "days", day),
      {
        ...bump(tally),
        ...scheduled,
        ...byKind("tenses", summary.tenseDays[day]),
        ...byKind("writing", summary.writingDays[day]),
        ...byKind("listening", summary.listeningDays[day]),
        ...missed,
      },
      { merge: true },
    );
  }
  batch.set(statsDoc(uid, "summary"), summaryUpdate(summary), { merge: true });
  if (plan.fresh.length > 0) batch.set(statsDoc(uid, "seen"), { items: arrayUnion(...plan.fresh) }, { merge: true });
  await batch.commit();
}

/**
 * Saves the streak carried between drills. The newest copy wins, so an older one from another device can't undo a
 * miss. The day's best and the all-time record keep the higher number, and a write can't take a maximum, so they're
 * read first in a transaction.
 */
export async function saveDrillStreak(running: RunningStreak) {
  const uid = await currentUid();
  if (!uid) throw new Error("Not signed in");
  const records = statsDoc(uid, "records");
  const day = doc(db(), "users", uid, "days", running.day);
  await runTransaction(db(), async (t) => {
    const [saved, savedDay] = await Promise.all([t.get(records), t.get(day)]);
    const data = saved.data();
    const update: { running?: RunningStreak; drillStreak?: StreakRecord } = {};
    if (running.at > (data?.running?.at ?? 0)) update.running = running;
    if (running.best > (data?.drillStreak?.streak ?? 0)) update.drillStreak = { streak: running.best, day: running.day };
    if (update.running || update.drillStreak) t.set(records, update, { merge: true });
    // A best of 0 is left out, so a day with only misses isn't written before its answers.
    if (running.best > (savedDay.data()?.bestStreak ?? 0)) t.set(day, { bestStreak: running.best }, { merge: true });
  });
}

/** The streak carried between drills, as last saved from any device. Null when signed out or never saved. */
export async function loadDrillStreak(): Promise<RunningStreak | null> {
  const uid = await currentUid();
  if (!uid) return null;
  return ((await getDoc(statsDoc(uid, "records"))).data()?.running as RunningStreak | undefined) ?? null;
}

const TALLY_MAPS =["tenses", "verbs", "kinds", "writing", "listening"] as const;

type Bumped = ReturnType<typeof bump>;

/** Leaves empty maps out: merging an empty map replaces the stored one, which would erase those stats. */
export function summaryUpdate(summary: Summary) {
  const update: Bumped & Partial<Record<(typeof TALLY_MAPS)[number], Record<string, Bumped>>> = bump(summary.total);
  for (const name of TALLY_MAPS) {
    const entries = Object.entries(summary[name]);
    if (entries.length > 0) update[name] = Object.fromEntries(entries.map(([id, tally]) => [id, bump(tally)]));
  }
  return update;
}

export interface ProgressData {
  total: Tally;
  tenses: Record<string, Tally>;
  verbs: Record<string, Tally>;
  kinds: Record<string, Tally>;
  writing: Record<string, Tally>;
  listening: Record<string, Tally>;
  days: Record<string, DayTally>;
  practiced: number;
  mastered: number;
  dueToday: number;
  reviewsPerDay: number;
  /** Every item that has a schedule. */
  seen: string[];
  /** Null until a drill streak has been saved. */
  drillStreak: StreakRecord | null;
  course: CourseProgress;
  /** Badges earned, by ID, with the day each was first seen. */
  badges: Record<string, string>;
  /** Level changes, oldest first, saved from 2026-11-08 on. */
  levelHistory: LevelChange[];
}

export async function loadProgress(uid: string): Promise<ProgressData> {
  const items = collection(db(), "users", uid, "items");
  const cutoff = localDay(new Date(Date.now() - DAYS_TO_LOAD * 24 * 60 * 60 * 1000));
  const [summary, recent, practiced, mastered, dueToday, seen, settings, records, course, badges] = await Promise.all([
    getDoc(statsDoc(uid, "summary")),
    // Days are keyed by date, so a range on the ID needs no custom index, unlike sorting it descending.
    getDocs(query(collection(db(), "users", uid, "days"), where(documentId(), ">=", cutoff))),
    getCountFromServer(items),
    getCountFromServer(query(items, where("stability", ">=", MASTERED_DAYS))),
    getCountFromServer(query(items, where("due", "<=", localDay()))),
    getDoc(statsDoc(uid, "seen")),
    getDoc(statsDoc(uid, "settings")),
    getDoc(statsDoc(uid, "records")),
    getDoc(statsDoc(uid, "course")),
    getDoc(statsDoc(uid, "badges")),
  ]);
  const data = summary.data() ?? {};
  return {
    total: { right: data.right ?? 0, accent: data.accent ?? 0, wrong: data.wrong ?? 0 },
    tenses: (data.tenses ?? {}) as Record<string, Tally>,
    verbs: (data.verbs ?? {}) as Record<string, Tally>,
    kinds: (data.kinds ?? {}) as Record<string, Tally>,
    writing: (data.writing ?? {}) as Record<string, Tally>,
    listening: (data.listening ?? {}) as Record<string, Tally>,
    days: Object.fromEntries(recent.docs.map((d) => [d.id, d.data() as DayTally])),
    practiced: practiced.data().count,
    mastered: mastered.data().count,
    dueToday: dueToday.data().count,
    reviewsPerDay: reviewSettings(settings.data()).reviewsPerDay,
    seen: seen.data()?.items ?? [],
    drillStreak: (records.data()?.drillStreak as StreakRecord | undefined) ?? null,
    course: parseCourse(course.data()),
    badges: Object.fromEntries(Object.entries(badges.data() ?? {}).filter((e): e is [string, string] => typeof e[1] === "string")),
    levelHistory: parseLevelHistory(settings.data()?.levelHistory),
  };
}

/** Items expected to stick for at least MASTERED_DAYS, as saved IDs like `verb:hablar:present`, most solid first. */
export async function loadMastered(): Promise<string[]> {
  const uid = await currentUid();
  if (!uid) return [];
  const items = collection(db(), "users", uid, "items");
  const found = await getDocs(query(items, where("stability", ">=", MASTERED_DAYS), orderBy("stability", "desc")));
  return found.docs.map((d) => d.id);
}

/** Null when nobody is signed in. */
export async function loadToday(): Promise<TodayData | null> {
  const uid = await currentUid();
  if (!uid) return null;
  const today = localDay();
  const items = collection(db(), "users", uid, "items");
  const [due, seen, day, settings, wanted] = await Promise.all([
    // Loads enough for the highest setting, so this can run alongside reading the setting.
    getDocs(query(items, where("due", "<=", today), orderBy("due"), limit(MAX_REVIEWS_PER_DAY))),
    getDoc(statsDoc(uid, "seen")),
    getDoc(doc(db(), "users", uid, "days", today)),
    loadReviewSettings(uid),
    getDoc(statsDoc(uid, "wanted")),
  ]);
  return {
    due: due.docs.map((d) => d.id),
    seen: seen.data()?.items ?? [],
    newDone: day.data()?.newItems ?? 0,
    reviewsDone: day.data()?.reviews ?? 0,
    ...settings,
    wanted: wanted.data()?.items ?? [],
  };
}

/** What's already scheduled or asked for, so a word looked up while reading can say so. Null when nobody is signed in. */
export async function loadReviewState(): Promise<{ seen: string[]; wanted: string[] } | null> {
  const uid = await currentUid();
  if (!uid) return null;
  const [seen, wanted] = await Promise.all([getDoc(statsDoc(uid, "seen")), getDoc(statsDoc(uid, "wanted"))]);
  return { seen: seen.data()?.items ?? [], wanted: wanted.data()?.items ?? [] };
}

/** Puts an item at the front of the new ones in Today's review. It stays on the list after that: Today's review skips started items. */
export async function addWanted(item: string) {
  const uid = await currentUid();
  if (!uid) throw new Error("Not signed in");
  await setDoc(statsDoc(uid, "wanted"), { items: arrayUnion(item) }, { merge: true });
}

/** Hides a mistake from the list, or shows it again. The mistake itself stays saved and counted. */
export async function setMistakeHidden(day: string, mistake: Mistake, hidden: boolean) {
  const uid = await currentUid();
  if (!uid) throw new Error("Not signed in");
  // Exactly the saved fields, since arrayRemove only matches an exact copy.
  const { item, label, prompt, given, answer, grade } = mistake;
  const entry = { item, label, prompt, given, answer, grade };
  await setDoc(doc(db(), "users", uid, "days", day), { hiddenMistakes: hidden ? arrayUnion(entry) : arrayRemove(entry) }, { merge: true });
}

/** Keeps the day each badge was first earned. Only new ones are sent, and merging never moves a saved day. */
export async function saveBadges(uid: string, earned: Record<string, string>) {
  if (Object.keys(earned).length === 0) return;
  await setDoc(statsDoc(uid, "badges"), earned, { merge: true });
}

/** Merges this browser's course progress with the account's and saves the result, which it returns. */
export async function saveCourse(local: CourseProgress): Promise<CourseProgress> {
  const uid = await currentUid();
  if (!uid) throw new Error("Not signed in");
  const ref = statsDoc(uid, "course");
  return runTransaction(db(), async (t) => {
    const saved = parseCourse((await t.get(ref)).data());
    const merged = mergeCourse(saved, local);
    if (!sameCourse(merged, saved)) t.set(ref, merged);
    return merged;
  });
}

/** The account's level and when it was chosen (0 if saved before that was kept). Null when nobody is signed in or none is saved. */
export async function loadLevel(): Promise<{ level: Level; at: number } | null> {
  const uid = await currentUid();
  if (!uid) return null;
  const data = (await getDoc(statsDoc(uid, "settings"))).data();
  return isLevel(data?.level) ? { level: data.level, at: typeof data.levelAt === "number" ? data.levelAt : 0 } : null;
}

/** Also adds the change to `levelHistory`, with its day, for the trend on /progress. */
export async function saveLevel(level: Level, at: number) {
  const uid = await currentUid();
  if (!uid) throw new Error("Not signed in");
  const change: LevelChange = { level, day: localDay(new Date(at)) };
  await setDoc(statsDoc(uid, "settings"), { level, levelAt: at, levelHistory: arrayUnion(change) }, { merge: true });
}

function parseLevelHistory(value: unknown): LevelChange[] {
  if (!Array.isArray(value)) return [];
  return value.filter((c): c is LevelChange => isLevel(c?.level) && typeof c?.day === "string");
}

export interface ReviewSettings {
  newPerDay: number;
  reviewsPerDay: number;
}

const reviewSettings = (data: { newPerDay?: number; reviewsPerDay?: number } | undefined): ReviewSettings => ({
  newPerDay: data?.newPerDay ?? DEFAULT_NEW_PER_DAY,
  reviewsPerDay: data?.reviewsPerDay ?? DEFAULT_REVIEWS_PER_DAY,
});

export async function loadReviewSettings(uid: string): Promise<ReviewSettings> {
  return reviewSettings((await getDoc(statsDoc(uid, "settings"))).data());
}

export async function saveReviewSetting(uid: string, setting: Partial<ReviewSettings>) {
  await setDoc(statsDoc(uid, "settings"), setting, { merge: true });
}

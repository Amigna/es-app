import {
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
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { localDay, summarize, type Answer, type Summary, type Tally } from "./progress";
import { DEFAULT_NEW_PER_DAY, MASTERED_DAYS, REVIEWS_PER_DAY, planReviews, schedulable, type Schedule, type TodayData } from "./schedule";

// Everything lives under users/{uid}: `items` per thing practiced, `days` per calendar day, and `stats` for the
// summary, the list of scheduled items and settings. Pages read those instead of scanning items.

const DAYS_TO_LOAD = 120;

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
    batch.set(doc(db(), "users", uid, "days", day), { ...bump(tally), ...scheduled }, { merge: true });
  }
  batch.set(statsDoc(uid, "summary"), summaryUpdate(summary), { merge: true });
  if (plan.fresh.length > 0) batch.set(statsDoc(uid, "seen"), { items: arrayUnion(...plan.fresh) }, { merge: true });
  await batch.commit();
}

const TALLY_MAPS = ["tenses", "verbs", "kinds"] as const;

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
  days: Record<string, Tally>;
  practiced: number;
  mastered: number;
  dueToday: number;
  /** Every item that has a schedule. */
  seen: string[];
}

export async function loadProgress(uid: string): Promise<ProgressData> {
  const items = collection(db(), "users", uid, "items");
  const cutoff = localDay(new Date(Date.now() - DAYS_TO_LOAD * 24 * 60 * 60 * 1000));
  const [summary, recent, practiced, mastered, dueToday, seen] = await Promise.all([
    getDoc(statsDoc(uid, "summary")),
    // Days are keyed by date, so a range on the ID needs no custom index, unlike sorting it descending.
    getDocs(query(collection(db(), "users", uid, "days"), where(documentId(), ">=", cutoff))),
    getCountFromServer(items),
    getCountFromServer(query(items, where("stability", ">=", MASTERED_DAYS))),
    getCountFromServer(query(items, where("due", "<=", localDay()))),
    getDoc(statsDoc(uid, "seen")),
  ]);
  const data = summary.data() ?? {};
  return {
    total: { right: data.right ?? 0, accent: data.accent ?? 0, wrong: data.wrong ?? 0 },
    tenses: (data.tenses ?? {}) as Record<string, Tally>,
    verbs: (data.verbs ?? {}) as Record<string, Tally>,
    kinds: (data.kinds ?? {}) as Record<string, Tally>,
    days: Object.fromEntries(recent.docs.map((d) => [d.id, d.data() as Tally])),
    practiced: practiced.data().count,
    mastered: mastered.data().count,
    dueToday: dueToday.data().count,
    seen: seen.data()?.items ?? [],
  };
}

/** Null when nobody is signed in. */
export async function loadToday(): Promise<TodayData | null> {
  const uid = await currentUid();
  if (!uid) return null;
  const today = localDay();
  const items = collection(db(), "users", uid, "items");
  const [due, seen, day, settings] = await Promise.all([
    getDocs(query(items, where("due", "<=", today), orderBy("due"), limit(REVIEWS_PER_DAY))),
    getDoc(statsDoc(uid, "seen")),
    getDoc(doc(db(), "users", uid, "days", today)),
    getDoc(statsDoc(uid, "settings")),
  ]);
  return {
    due: due.docs.map((d) => d.id),
    seen: seen.data()?.items ?? [],
    newDone: day.data()?.newItems ?? 0,
    reviewsDone: day.data()?.reviews ?? 0,
    newPerDay: settings.data()?.newPerDay ?? DEFAULT_NEW_PER_DAY,
  };
}

export async function loadNewPerDay(uid: string): Promise<number> {
  return (await getDoc(statsDoc(uid, "settings"))).data()?.newPerDay ?? DEFAULT_NEW_PER_DAY;
}

export async function saveNewPerDay(uid: string, newPerDay: number) {
  await setDoc(statsDoc(uid, "settings"), { newPerDay }, { merge: true });
}

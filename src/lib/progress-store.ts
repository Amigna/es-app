import {
  collection,
  doc,
  documentId,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { localDay, summarize, type Answer, type Summary, type Tally } from "./progress";

// Everything lives under users/{uid}: `items` per thing practiced, `days` per calendar day, and one
// `stats/summary`. The progress page reads the summary and recent days instead of scanning items.

// An item counts as mastered after this many correct answers, until spaced repetition replaces it.
export const MASTERED_AT = 5;
const DAYS_TO_LOAD = 120;

const bump = (t: Tally) => ({ right: increment(t.right), accent: increment(t.accent), wrong: increment(t.wrong) });

export async function saveAnswers(answers: Answer[]) {
  await auth().authStateReady();
  const uid = auth().currentUser?.uid;
  // Throwing keeps the answers queued for when they're signed in again.
  if (!uid) throw new Error("Not signed in");

  const summary = summarize(answers);
  const { items, days } = summary;
  const batch = writeBatch(db());
  for (const [id, item] of Object.entries(items)) {
    batch.set(doc(db(), "users", uid, "items", id), { ...bump(item), last: item.last }, { merge: true });
  }
  for (const [day, tally] of Object.entries(days)) {
    batch.set(doc(db(), "users", uid, "days", day), bump(tally), { merge: true });
  }
  batch.set(doc(db(), "users", uid, "stats", "summary"), summaryUpdate(summary), { merge: true });
  await batch.commit();
}

/** Leaves `tenses` out when empty: merging an empty map replaces the stored one, which would erase the tense stats. */
export function summaryUpdate({ total, tenses }: Summary) {
  const ids = Object.keys(tenses);
  if (ids.length === 0) return bump(total);
  return { ...bump(total), tenses: Object.fromEntries(ids.map((id) => [id, bump(tenses[id])])) };
}

export interface ProgressData {
  total: Tally;
  tenses: Record<string, Tally>;
  days: Record<string, Tally>;
  practiced: number;
  mastered: number;
}

export async function loadProgress(uid: string): Promise<ProgressData> {
  const items = collection(db(), "users", uid, "items");
  const cutoff = localDay(new Date(Date.now() - DAYS_TO_LOAD * 24 * 60 * 60 * 1000));
  const [summary, recent, practiced, mastered] = await Promise.all([
    getDoc(doc(db(), "users", uid, "stats", "summary")),
    // Days are keyed by date, so a range on the ID needs no custom index, unlike sorting it descending.
    getDocs(query(collection(db(), "users", uid, "days"), where(documentId(), ">=", cutoff))),
    getCountFromServer(items),
    getCountFromServer(query(items, where("right", ">=", MASTERED_AT))),
  ]);
  const data = summary.data() ?? {};
  return {
    total: { right: data.right ?? 0, accent: data.accent ?? 0, wrong: data.wrong ?? 0 },
    tenses: (data.tenses ?? {}) as Record<string, Tally>,
    days: Object.fromEntries(recent.docs.map((d) => [d.id, d.data() as Tally])),
    practiced: practiced.data().count,
    mastered: mastered.data().count,
  };
}

"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AccuracyTrend, PracticeCalendar } from "@/components/ProgressCharts";
import { TENSES } from "@/lib/conjugation/types";
import { useDrillSettings } from "@/lib/drill-settings";
import { auth, firebaseConfigured, isInvited } from "@/lib/firebase";
import { MAX_PRACTICE_ITEMS, practiceHref, weakSpots, type WeakSpot } from "@/lib/practice";
import { accentRate, accuracy, answered, currentStreak, lastSevenDays, localDay, recentWeeks, wordsPracticed, type Tally } from "@/lib/progress";
import { saveProgress, setProgressEnabled } from "@/lib/progress-queue";
import { DAYS_TO_LOAD, loadProgress, type ProgressData } from "@/lib/progress-store";
import { MASTERED_DAYS } from "@/lib/schedule";

const SAVE_WAIT_MS = 5000;
const WEEKS_SHOWN = 6;
// Days are loaded about 17 weeks back, so the trend covers 12 of them.
const TREND_WEEKS = 12;

interface WordListTotal {
  type: string;
  title: string;
  total: number;
}

type State =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "notInvited" }
  | { status: "failed" }
  | { status: "ready"; data: ProgressData };

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      {note && <p className="mt-1 text-sm text-stone-500">{note}</p>}
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400">
      {children}
    </div>
  );
}

const linkClass = "text-accent-700 underline dark:text-accent-400";

function SpotList({ title, spots }: { title: string; spots: WeakSpot[] }) {
  if (spots.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 font-medium">{title}</h3>
      <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
        {spots.map((spot) => (
          <li key={spot.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
            <span>
              <span className="block">{spot.label}</span>
              <span className="block text-sm text-stone-500">{spot.detail}</span>
            </span>
            <Link
              href={practiceHref(spot.target)}
              aria-label={`Practice ${spot.label}`}
              className="flex min-h-10 items-center text-sm font-medium text-accent-700 underline dark:text-accent-400"
            >
              Practice this
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WeakSpotsSection({ data }: { data: ProgressData }) {
  const { tenses, verbs, mistakes } = weakSpots(data);
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">Weak spots</h2>
      {tenses.length + verbs.length + mistakes.length === 0 ? (
        <p className="text-stone-600 dark:text-stone-400">None right now. Weak spots show up here after 5 or more answers on something you keep missing.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <SpotList title="Tenses" spots={tenses} />
          <SpotList title="Verbs" spots={verbs} />
          <SpotList title="Mistake types" spots={mistakes} />
        </div>
      )}
    </section>
  );
}

const weekLabel = (ago: number) => (ago === 0 ? "Last 7 days" : ago === 1 ? "1 week ago" : `${ago} weeks ago`);

const weekCell = (tally: Tally) => (answered(tally) === 0 ? "–" : `${accuracy(tally) ?? "–"}% of ${answered(tally).toLocaleString()}`);

const slipCell = (tally: Tally) => (answered(tally) === 0 ? "–" : `${accentRate(tally)}% (${tally.accent.toLocaleString()})`);

/** Newest first. Weeks with nothing in any column are left out. */
function WeekTable({ columns }: { columns: { title: string; weeks: Tally[]; cell?: (tally: Tally) => string }[] }) {
  const shown = Array.from({ length: WEEKS_SHOWN }, (_, ago) => ago).filter((ago) => columns.some((c) => answered(c.weeks[ago]) > 0));
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-stone-200 text-sm text-stone-500 dark:border-stone-800">
            <th scope="col" className="px-4 py-2 font-medium">Week</th>
            {columns.map((c) => (
              <th key={c.title} scope="col" className="px-4 py-2 text-right font-medium">{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((ago) => (
            <tr key={ago} className="border-b border-stone-100 last:border-0 dark:border-stone-800">
              <th scope="row" className="px-4 py-2 font-normal">{weekLabel(ago)}</th>
              {columns.map((c) => (
                <td key={c.title} className="px-4 py-2 text-right tabular-nums">{(c.cell ?? weekCell)(c.weeks[ago])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WritingSection({ data }: { data: ProgressData }) {
  const [, update] = useDrillSettings();
  const today = localDay();
  const sides = [
    { id: "toEnglish", title: "Spanish to English" },
    { id: "toSpanish", title: "English to Spanish" },
  ];
  const started = sides.some((s) => data.writing[s.id]);
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">Writing</h2>
      {started ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {sides.map(({ id, title }) => {
              const tally = data.writing[id];
              return <Tile key={id} label={title} value={tally ? `${accuracy(tally)}%` : "–"} note={tally ? `of ${answered(tally).toLocaleString()} sentences` : "None yet"} />;
            })}
          </div>
          <WeekTable columns={sides.map(({ id, title }) => ({ title, weeks: recentWeeks(data.days, today, (day) => day.writing?.[id], WEEKS_SHOWN) }))} />
          <p className="text-sm text-stone-500">Includes the sentences you marked as right yourself.</p>
        </div>
      ) : (
        <p className="text-stone-600 dark:text-stone-400">
          <Link href="/drill" onClick={() => update({ mode: "writing" })} className={linkClass}>
            Try a writing drill
          </Link>{" "}
          and your results will show up here.
        </p>
      )}
    </section>
  );
}

function ListeningSection({ data }: { data: ProgressData }) {
  const [, update] = useDrillSettings();
  const tally = data.listening.dictation;
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">Listening</h2>
      {tally ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Tile label="Dictation" value={`${accuracy(tally)}%`} note={`of ${answered(tally).toLocaleString()} sentences`} />
          </div>
          <WeekTable columns={[{ title: "Dictation", weeks: recentWeeks(data.days, localDay(), (day) => day.listening?.dictation, WEEKS_SHOWN) }]} />
          <p className="text-sm text-stone-500">Correct means every word. Sentences with only accent slips are left out of the percentage.</p>
        </div>
      ) : (
        <p className="text-stone-600 dark:text-stone-400">
          <Link href="/drill" onClick={() => update({ mode: "listening" })} className={linkClass}>
            Try a dictation drill
          </Link>{" "}
          and your results will show up here.
        </p>
      )}
    </section>
  );
}

const MISTAKES_SHOWN = 20;

function dayLabel(day: string, today: string): string {
  if (day === today) return "Today";
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (localDay(new Date(y, m - 1, d + 1)) === today) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** What was actually typed, newest first. Seeing the wrong forms side by side shows patterns a percentage hides. */
function MistakesSection({ data }: { data: ProgressData }) {
  const [showAll, setShowAll] = useState(false);
  const today = localDay();
  // A day's list is saved in the order answered, so it's reversed for newest first.
  const all = Object.keys(data.days)
    .sort()
    .reverse()
    .flatMap((day) => [...(data.days[day].mistakes ?? [])].reverse().map((m) => ({ ...m, day })));
  if (all.length === 0) return null;

  // By answer as well as item: every dictation sentence shares one item, and a verb's tense covers five forms.
  const key = (m: { item: string; answer: string }) => `${m.item}|${m.answer}`;
  const times = new Map<string, number>();
  for (const m of all) times.set(key(m), (times.get(key(m)) ?? 0) + 1);
  const practice = [...new Set(all.map((m) => m.item).filter((item) => item.startsWith("verb:") || item.startsWith("vocab:")))];
  const shown = showAll ? all : all.slice(0, MISTAKES_SHOWN);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-xl font-semibold">Recent mistakes</h2>
        {practice.length > 0 && (
          <Link href={practiceHref({ items: practice })} className={`text-sm font-medium ${linkClass}`}>
            Practice the latest {Math.min(practice.length, MAX_PRACTICE_ITEMS)}
          </Link>
        )}
      </div>
      <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
        {shown.map((m, i) => {
          const count = times.get(key(m)) ?? 1;
          return (
            <li key={i} className="space-y-1 px-4 py-3">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-500">
                {m.label && !m.prompt.includes(m.label) && (
                  <span className="rounded-md bg-accent-100 px-2 py-0.5 font-medium text-accent-900 dark:bg-accent-950 dark:text-accent-200">{m.label}</span>
                )}
                <span>{dayLabel(m.day, today)}</span>
                {count > 1 && <span className="font-medium text-red-700 dark:text-red-400">Missed {count} times</span>}
              </p>
              {m.prompt && <p className="text-stone-700 dark:text-stone-300">{m.prompt}</p>}
              <p className="flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  <span className="text-sm text-stone-500">You: </span>
                  {m.given ? (
                    <span className={`font-medium ${m.grade === "accent" ? "text-amber-700 dark:text-amber-400" : "text-red-700 line-through dark:text-red-400"}`}>
                      {m.given}
                    </span>
                  ) : (
                    <span className="italic text-stone-500">didn&apos;t know</span>
                  )}
                </span>
                <span>
                  <span className="text-sm text-stone-500">Answer: </span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">{m.answer}</span>
                </span>
              </p>
            </li>
          );
        })}
      </ul>
      {all.length > MISTAKES_SHOWN && (
        <button type="button" onClick={() => setShowAll(!showAll)} className={`mt-2 min-h-10 text-sm ${linkClass}`}>
          {showAll ? "Show fewer" : `Show all ${all.length.toLocaleString()}`}
        </button>
      )}
      <p className="mt-2 text-sm text-stone-500">
        From the last {DAYS_TO_LOAD} days. Only first tries are kept, and flashcards aren&apos;t, since nothing is typed on them.
      </p>
    </section>
  );
}

function VocabularySection({ data, wordLists }: { data: ProgressData; wordLists: WordListTotal[] }) {
  const [, update] = useDrillSettings();
  const practiced = wordsPracticed(data.seen);
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">Vocabulary</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {wordLists.map(({ type, title, total }) => (
          <Tile key={type} label={title} value={(practiced[type] ?? 0).toLocaleString()} note={`of ${total.toLocaleString()} practiced`} />
        ))}
      </div>
      <p className="mt-3">
        <Link href="/drill" onClick={() => update({ mode: "flashcards" })} className={linkClass}>
          Practice with flashcards
        </Link>
      </p>
    </section>
  );
}

function Stats({ data, wordLists }: { data: ProgressData; wordLists: WordListTotal[] }) {
  const [, update] = useDrillSettings();
  const today = localDay();
  const total = answered(data.total);
  const streak = currentStreak(Object.keys(data.days), today);
  const overall = accuracy(data.total);
  const tenseRows = TENSES.flatMap((t) => {
    const tally = data.tenses[t.id];
    return tally && answered(tally) > 0 ? [{ meta: t, tally }] : [];
  });

  if (total === 0) {
    return (
      <Message>
        Nothing saved yet. <Link href="/drill" className={linkClass}>Try a drill</Link> and your results will show up here.
      </Message>
    );
  }

  return (
    <div className="space-y-8">
      {data.dueToday > 0 && (
        <p>
          {data.dueToday.toLocaleString()} {data.dueToday === 1 ? "item is" : "items are"} due today.{" "}
          <Link href="/drill" onClick={() => update({ mode: "review" })} className={linkClass}>
            Start today&apos;s review
          </Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile label="Current streak" value={`${streak} ${streak === 1 ? "day" : "days"}`} />
        <Tile label="Last 7 days" value={lastSevenDays(data.days, today).toLocaleString()} note="questions" />
        <Tile label="All time" value={total.toLocaleString()} note={overall === null ? undefined : `${overall}% correct`} />
        <Tile label="Accent slips" value={`${accentRate(data.total) ?? 0}%`} note={`${data.total.accent.toLocaleString()} answers`} />
        <Tile label="Mastered" value={data.mastered.toLocaleString()} note={`of ${data.practiced.toLocaleString()} practiced`} />
      </div>

      {/* Side by side on wide screens, where the calendar alone would leave most of the row empty. */}
      <div className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)]">
        <section>
          <h2 className="mb-3 font-display text-2xl font-semibold">Practice calendar</h2>
          <PracticeCalendar days={data.days} today={today} />
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">Accuracy by week</h2>
          <AccuracyTrend weeks={recentWeeks(data.days, today, (day) => day, TREND_WEEKS)} />
          <WeekTable
            columns={[
              { title: "All questions", weeks: recentWeeks(data.days, today, (day) => day, WEEKS_SHOWN) },
              { title: "Accent slips", weeks: recentWeeks(data.days, today, (day) => day, WEEKS_SHOWN), cell: slipCell },
            ]}
          />
        </section>
      </div>

      <WeakSpotsSection data={data} />

      <MistakesSection data={data} />

      <VocabularySection data={data} wordLists={wordLists} />

      <WritingSection data={data} />

      <ListeningSection data={data} />

      {tenseRows.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Accuracy by tense</h2>
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-stone-200 text-sm text-stone-500 dark:border-stone-800">
                  <th scope="col" className="px-4 py-2 font-medium">Tense</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Answered</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Correct</th>
                </tr>
              </thead>
              <tbody>
                {tenseRows.map(({ meta, tally }) => (
                  <tr key={meta.id} className="border-b border-stone-100 last:border-0 dark:border-stone-800">
                    <th scope="row" className="px-4 py-2 font-normal">{meta.name}</th>
                    <td className="px-4 py-2 text-right tabular-nums">{answered(tally).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{accuracy(tally)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p className="text-stone-600 dark:text-stone-400">Accuracy by tense shows up after a conjugation or fill-in-the-blank drill.</p>
      )}

      <p className="text-sm text-stone-500">
        Accent slips, where the letters are right but an accent is missing or wrong, are counted on their own and left out of
        the correct percentages, so they neither lower nor raise them. When the accent turns the answer into a different word, like
        hablo for habló, it counts as wrong. Mastered means you&apos;re expected to remember it for at
        least {MASTERED_DAYS} days, and only the first try at a question counts. A word counts as practiced after any question about it.
      </p>
    </div>
  );
}

export default function ProgressView({ wordLists }: { wordLists: WordListTotal[] }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!firebaseConfigured) return;
    async function load(user: User | null) {
      if (!user) {
        setState({ status: "signedOut" });
        return;
      }
      try {
        if (!(await isInvited(user.email ?? ""))) {
          setProgressEnabled(false);
          setState({ status: "notInvited" });
          return;
        }
        setProgressEnabled(true);
        // Include any answers still waiting to be saved. Offline, a write waits for the connection, so don't wait forever.
        await Promise.race([saveProgress(), new Promise((resolve) => setTimeout(resolve, SAVE_WAIT_MS))]);
        setState({ status: "ready", data: await loadProgress(user.uid) });
      } catch (err) {
        console.error("Couldn't load progress", err);
        setState({ status: "failed" });
      }
    }
    return onAuthStateChanged(auth(), load);
  }, []);

  if (!firebaseConfigured) return <Message>Progress isn&apos;t available right now.</Message>;
  if (state.status === "loading") return <p className="text-stone-500">Loading…</p>;
  if (state.status === "signedOut") {
    return (
      <Message>
        <Link href="/account" prefetch={false} className={linkClass}>Sign in</Link> to see your progress. Saved progress is invite-only for now.
      </Message>
    );
  }
  if (state.status === "notInvited") {
    return (
      <Message>
        Saved progress is invite-only for now. <Link href="/account" prefetch={false} className={linkClass}>Check your account</Link> to request
        access or see your request.
      </Message>
    );
  }
  if (state.status === "failed") return <Message>Couldn&apos;t load your progress. Check your connection and try again.</Message>;
  return <Stats data={state.data} wordLists={wordLists} />;
}

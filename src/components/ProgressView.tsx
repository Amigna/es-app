"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AccuracyTrend, PracticeCalendar } from "@/components/ProgressCharts";
import BadgeArt from "@/components/Badge";
import { LevelSuggestion } from "@/components/LevelPicker";
import ReportProblem from "@/components/ReportProblem";
import { BADGES, earnedBadges, findBadge, nextBadges, withSaved } from "@/lib/badges";
import { TENSES } from "@/lib/conjugation/types";
import { CHAPTERS, EXAM_LEVELS, EXAM_PASS_SCORE, PASS_SCORE, chaptersDone, examId, levelChapters } from "@/lib/course";
import { syncCourse } from "@/lib/course-progress";
import { useDrillSettings } from "@/lib/drill-settings";
import { auth, firebaseConfigured } from "@/lib/firebase";
import { useLevel } from "@/lib/level";
import { levelChangesByWeek } from "@/lib/level-up";
import { MAX_PRACTICE_ITEMS, practiceHref, weakSpots, type WeakSpot } from "@/lib/practice";
import { accentRate, accuracy, answered, currentStreak, lastSevenDays, localDay, recentWeeks, weeklyBestStreaks, wordsPracticed, type Mistake, type Tally } from "@/lib/progress";
import { saveProgress, setProgressEnabled } from "@/lib/progress-queue";
import { DAYS_TO_LOAD, loadMastered, loadProgress, saveBadges, setMistakeHidden, type ProgressData } from "@/lib/progress-store";
import { MASTERED_DAYS, reviewsLeft } from "@/lib/schedule";

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
  | { status: "failed" }
  | { status: "ready"; data: ProgressData };

function Tile({ label, value, note, onClick, expanded }: { label: string; value: string; note?: string; onClick?: () => void; expanded?: boolean }) {
  const body = (
    <>
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      {note && <p className="mt-1 text-sm text-stone-500">{note}</p>}
    </>
  );
  const box = "rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900";
  if (!onClick) return <div className={box}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className={`${box} text-left transition hover:border-accent-400 dark:hover:border-accent-600`}
    >
      {body}
      <p className="mt-1 text-sm font-medium text-accent-700 underline dark:text-accent-400">{expanded ? "Hide the list" : "Show the list"}</p>
    </button>
  );
}

/** What's mastered, as words and as verb tenses, so the tile's number can be checked against real items. */
function MasteredList({ wordLists }: { wordLists: WordListTotal[] }) {
  const [items, setItems] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    loadMastered().then(setItems, (err) => {
      console.error("Couldn't load mastered items", err);
      setFailed(true);
    });
  }, []);

  if (failed) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        Couldn&apos;t load the list. Check your connection and try again.
      </p>
    );
  }
  if (!items) return <p className="text-stone-500">Loading…</p>;
  if (items.length === 0) return <p className="text-stone-600 dark:text-stone-400">Nothing is mastered yet. Keep reviewing and words will show up here.</p>;

  // A word counts once however many ways it's asked, and a verb lists the tenses that have stuck.
  const tenses = new Map<string, string[]>();
  const words = new Map<string, Set<string>>();
  for (const item of items) {
    const [kind, a, b] = item.split(":");
    if (kind === "verb") {
      tenses.set(a, [...(tenses.get(a) ?? []), TENSES.find((t) => t.id === b)?.name ?? b]);
    } else if (kind === "vocab") {
      const [, type, es] = item.split(":");
      (words.get(type) ?? words.set(type, new Set()).get(type)!).add(es);
    }
  }
  const titles = new Map(wordLists.map((l) => [l.type, l.title]));
  const listClass = "divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900";

  return (
    <div className="space-y-4">
      {tenses.size > 0 && (
        <div>
          <h3 className="mb-2 font-medium">Verb tenses</h3>
          <ul className={listClass}>
            {[...tenses].map(([inf, names]) => (
              <li key={inf} className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 py-2">
                <span className="font-medium">{inf}</span>
                <span className="text-sm text-stone-500">{names.join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {[...words].map(([type, set]) => (
        <div key={type}>
          <h3 className="mb-2 font-medium">
            {titles.get(type) ?? type} <span className="font-normal text-stone-500">{set.size.toLocaleString()}</span>
          </h3>
          <p className="rounded-xl border border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900">{[...set].join(", ")}</p>
        </div>
      ))}
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

/** Newest first. Weeks with nothing in any column are left out. `streaks` adds each week's longest drill streak. */
function WeekTable({ columns, streaks }: { columns: { title: string; weeks: Tally[]; cell?: (tally: Tally) => string }[]; streaks?: number[] }) {
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
            {streaks && <th scope="col" className="px-4 py-2 text-right font-medium">Best streak</th>}
          </tr>
        </thead>
        <tbody>
          {shown.map((ago) => (
            <tr key={ago} className="border-b border-stone-100 last:border-0 dark:border-stone-800">
              <th scope="row" className="px-4 py-2 font-normal">{weekLabel(ago)}</th>
              {columns.map((c) => (
                <td key={c.title} className="px-4 py-2 text-right tabular-nums">{(c.cell ?? weekCell)(c.weeks[ago])}</td>
              ))}
              {streaks && <td className="px-4 py-2 text-right tabular-nums">{streaks[ago] ? streaks[ago].toLocaleString() : "–"}</td>}
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

// The same as the practice link's count, so the list and the link match.
const MISTAKES_SHOWN = MAX_PRACTICE_ITEMS;

function dayLabel(day: string, today: string): string {
  if (day === today) return "Today";
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (localDay(new Date(y, m - 1, d + 1)) === today) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

type DayMistake = Mistake & { day: string };

const mistakeKey = (m: DayMistake) => JSON.stringify([m.day, m.item, m.label, m.prompt, m.given, m.answer, m.grade]);

/** What was actually typed, newest first. Seeing the wrong forms side by side shows patterns a percentage hides. */
function MistakesSection({ data }: { data: ProgressData }) {
  const [showAll, setShowAll] = useState(false);
  // Removed on this visit, so they can be undone. Ones removed before are left out altogether.
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState(false);
  const today = localDay();
  // A day's list is saved in the order answered, so it's reversed for newest first.
  const all = Object.keys(data.days)
    .sort()
    .reverse()
    .flatMap((day) => {
      const hidden = new Set((data.days[day].hiddenMistakes ?? []).map((m) => mistakeKey({ ...m, day })));
      return [...(data.days[day].mistakes ?? [])]
        .reverse()
        .map((m) => ({ ...m, day }))
        .filter((m) => !hidden.has(mistakeKey(m)));
    });
  if (all.length === 0) return null;

  async function setHidden(m: DayMistake, hidden: boolean) {
    const change = (hide: boolean) =>
      setRemoved((prev) => {
        const next = new Set(prev);
        if (hide) next.add(mistakeKey(m));
        else next.delete(mistakeKey(m));
        return next;
      });
    setFailed(false);
    change(hidden);
    try {
      await setMistakeHidden(m.day, m, hidden);
    } catch (err) {
      console.error("Couldn't change the mistake list", err);
      change(!hidden);
      setFailed(true);
    }
  }

  const kept = all.filter((m) => !removed.has(mistakeKey(m)));
  // By answer as well as item: every dictation sentence shares one item, and a verb's tense covers five forms.
  const key = (m: { item: string; answer: string }) => `${m.item}|${m.answer}`;
  const times = new Map<string, number>();
  for (const m of kept) times.set(key(m), (times.get(key(m)) ?? 0) + 1);
  const practice = [...new Set(kept.map((m) => m.item).filter((item) => item.startsWith("verb:") || item.startsWith("vocab:")))];
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
        {shown.map((m) => {
          if (removed.has(mistakeKey(m))) {
            return (
              <li key={mistakeKey(m)} className="flex flex-wrap items-center justify-between gap-x-4 px-4 py-1 text-sm text-stone-500">
                <span>Removed {m.answer} from your list.</span>
                <button type="button" onClick={() => setHidden(m, false)} className={`min-h-10 font-medium ${linkClass}`}>
                  Undo
                </button>
              </li>
            );
          }
          const count = times.get(key(m)) ?? 1;
          return (
            <li key={mistakeKey(m)} className="space-y-1 px-4 py-3">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-500">
                {m.label && !m.prompt.includes(m.label) && (
                  <span className="rounded-md bg-accent-100 px-2 py-0.5 font-medium text-accent-900 dark:bg-accent-950 dark:text-accent-200">{m.label}</span>
                )}
                <span>{dayLabel(m.day, today)}</span>
                {count > 1 && <span className="font-medium text-red-700 dark:text-red-400">Missed {count} times</span>}
                <button
                  type="button"
                  onClick={() => setHidden(m, true)}
                  aria-label={`Remove ${m.answer} from your list`}
                  title="Remove from your list"
                  className="-my-2.5 -mr-2 ml-auto flex min-h-10 min-w-10 items-center justify-center text-stone-400 transition hover:text-accent-700 dark:text-stone-500 dark:hover:text-accent-400"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4"
                  >
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                  </svg>
                </button>
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
              <ReportProblem
                about={`Mistake ${m.item}: typed "${m.given || "didn't know"}", answer "${m.answer}" | ${m.label} | ${m.prompt}`}
                message={m.given ? "I think my answer was correct." : ""}
              />
            </li>
          );
        })}
      </ul>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t change your list. Check your connection and try again.
        </p>
      )}
      {all.length > MISTAKES_SHOWN && (
        <button type="button" onClick={() => setShowAll(!showAll)} className={`mt-2 min-h-10 text-sm ${linkClass}`}>
          {showAll ? "Show fewer" : `Show all ${all.length.toLocaleString()}`}
        </button>
      )}
      <p className="mt-2 text-sm text-stone-500">
        From the last {DAYS_TO_LOAD} days. Only first tries are kept, and flashcards aren&apos;t, since nothing is typed on them.
        Removing a mistake hides it here, but it still counts in your stats.
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

/** Earned badges, newest first, and a few to aim for next. */
function BadgesSection({ data }: { data: ProgressData }) {
  const today = localDay();
  const earned = Object.entries(data.badges)
    .flatMap(([id, day]) => {
      const badge = findBadge(id);
      return badge ? [{ badge, day }] : [];
    })
    .sort((a, b) => b.day.localeCompare(a.day) || BADGES.indexOf(a.badge) - BADGES.indexOf(b.badge));
  const next = nextBadges(data.badges);
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">
        Badges{" "}
        <span className="text-base font-normal text-stone-500">
          {earned.length} of {BADGES.length}
        </span>
      </h2>
      {earned.length > 0 ? (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {earned.map(({ badge, day }) => (
            <li key={badge.id} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
              <BadgeArt badge={badge} />
              <span className="min-w-0">
                <span className="block font-medium">{badge.title}</span>
                <span className="block text-sm text-stone-500">{dayLabel(day, today)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-stone-600 dark:text-stone-400">None yet. Finish a course chapter, or keep a streak going, to earn your first.</p>
      )}
      {next.length > 0 && (
        <>
          <h3 className="mt-5 mb-2 font-medium">Next up</h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {next.map((badge) => (
              <li key={badge.id} className="flex items-center gap-3 rounded-xl border border-dashed border-stone-300 p-3 dark:border-stone-700">
                <BadgeArt badge={badge} size={44} locked />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{badge.title}</span>
                  <span className="block text-xs text-stone-500">{badge.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Checkpoints taken, with the first score beside the best, so improvement shows and not only a total. */
function CourseSection({ data }: { data: ProgressData }) {
  const today = localDay();
  // Each level's chapters, then its exam, as they come in the course.
  const rows = EXAM_LEVELS.flatMap((level) => [
    ...levelChapters(level).map((c) => ({ id: c.id, href: `/course/${c.id}`, name: `${CHAPTERS.indexOf(c) + 1}. ${c.title}` })),
    { id: examId(level), href: `/course/exam/${level.toLowerCase()}`, name: `${level} exam` },
  ]);
  const taken = rows.filter((r) => data.course[r.id]?.tries?.length);
  const done = chaptersDone(data.course);
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">Course</h2>
      {taken.length === 0 ? (
        <p className="text-stone-600 dark:text-stone-400">
          <Link href="/course" className={linkClass}>
            Start the course
          </Link>{" "}
          and your checkpoint and exam scores will show up here.
        </p>
      ) : (
        <div className="space-y-3">
          <p>
            {done} of {CHAPTERS.length} chapters done.
          </p>
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-stone-200 text-sm text-stone-500 dark:border-stone-800">
                  <th scope="col" className="px-4 py-2 font-medium">Chapter</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">First try</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Best</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Done</th>
                </tr>
              </thead>
              <tbody>
                {taken.map((r) => {
                  const mine = data.course[r.id];
                  return (
                    <tr key={r.id} className="border-b border-stone-100 last:border-0 dark:border-stone-800">
                      <th scope="row" className="px-4 py-2 font-normal">
                        <Link href={r.href} className="underline decoration-stone-300 underline-offset-2 dark:decoration-stone-600">
                          {r.name}
                        </Link>
                      </th>
                      <td className="px-4 py-2 text-right tabular-nums">{mine.tries![0].score}%</td>
                      <td className="px-4 py-2 text-right tabular-nums">{mine.best}%</td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">{mine.done ? dayLabel(mine.done, today) : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-stone-500">A checkpoint of {PASS_SCORE}% or more finishes a chapter, and an exam score of {EXAM_PASS_SCORE}% or more earns the level&apos;s badge. Retakes keep your best score.</p>
        </div>
      )}
    </section>
  );
}

function Stats({ data, wordLists }: { data: ProgressData; wordLists: WordListTotal[] }) {
  const [, update] = useDrillSettings();
  const [showMastered, setShowMastered] = useState(false);
  const level = useLevel();
  const today = localDay();
  const total = answered(data.total);
  const streak = currentStreak(Object.keys(data.days), today);
  const overall = accuracy(data.total);
  const inSession = Math.min(data.dueToday, reviewsLeft(data.reviewsPerDay, data.days[today]?.reviews ?? 0));
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
          {data.dueToday.toLocaleString()} {data.dueToday === 1 ? "item is" : "items are"} due.{" "}
          {inSession === 0
            ? "You've done today's reviews, so the rest come up on later days."
            : inSession < data.dueToday
              ? `Today's review covers the ${inSession.toLocaleString()} most overdue, and the rest come up on later days. `
              : null}
          {inSession > 0 && (
            <Link href="/drill" onClick={() => update({ mode: "review" })} className={linkClass}>
              Start today&apos;s review
            </Link>
          )}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Tile label="Current streak" value={`${streak} ${streak === 1 ? "day" : "days"}`} />
        <Tile
          label="Longest drill streak"
          value={data.drillStreak ? data.drillStreak.streak.toLocaleString() : "–"}
          note={
            data.drillStreak
              ? `in a row, set ${dayLabel(data.drillStreak.day, today).replace(/^(Today|Yesterday)$/, (w) => w.toLowerCase())}` +
                (data.days[today]?.bestStreak && data.drillStreak.day !== today ? ` · ${data.days[today].bestStreak!.toLocaleString()} today` : "")
              : "None saved yet"
          }
        />
        <Tile label="Last 7 days" value={lastSevenDays(data.days, today).toLocaleString()} note="questions" />
        <Tile label="All time" value={total.toLocaleString()} note={overall === null ? undefined : `${overall}% correct`} />
        <Tile label="Accent slips" value={`${accentRate(data.total) ?? 0}%`} note={`${data.total.accent.toLocaleString()} answers`} />
        <Tile
          label="Mastered"
          value={data.mastered.toLocaleString()}
          note={`of ${data.practiced.toLocaleString()} practiced`}
          onClick={data.mastered > 0 ? () => setShowMastered(!showMastered) : undefined}
          expanded={showMastered}
        />
      </div>

      {showMastered && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Mastered</h2>
          <MasteredList wordLists={wordLists} />
        </section>
      )}

      {level && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Your level</h2>
          <LevelSuggestion days={data.days} />
        </section>
      )}

      {/* Side by side on wide screens, where the calendar alone would leave most of the row empty. */}
      <div className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)]">
        <section>
          <h2 className="mb-3 font-display text-2xl font-semibold">Practice calendar</h2>
          <PracticeCalendar days={data.days} today={today} />
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">Accuracy by week</h2>
          <AccuracyTrend weeks={recentWeeks(data.days, today, (day) => day, TREND_WEEKS)} levels={levelChangesByWeek(data.levelHistory, today, TREND_WEEKS)} />
          <WeekTable
            columns={[
              { title: "All questions", weeks: recentWeeks(data.days, today, (day) => day, WEEKS_SHOWN) },
              { title: "Accent slips", weeks: recentWeeks(data.days, today, (day) => day, WEEKS_SHOWN), cell: slipCell },
            ]}
            streaks={weeklyBestStreaks(data.days, today, WEEKS_SHOWN)}
          />
        </section>
      </div>

      <BadgesSection data={data} />

      <WeakSpotsSection data={data} />

      <MistakesSection data={data} />

      <CourseSection data={data} />

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
        setProgressEnabled(true);
        // Include any answers still waiting to be saved. Offline, a write waits for the connection, so don't wait forever.
        await Promise.race([Promise.all([saveProgress(), syncCourse()]), new Promise((resolve) => setTimeout(resolve, SAVE_WAIT_MS))]);
        const data = await loadProgress(user.uid);
        // New badges get today's date, or the day the data shows, and keep it from then on.
        const earned = earnedBadges({ course: data.course, days: Object.keys(data.days), mastered: data.mastered, drillStreak: data.drillStreak }, localDay());
        const fresh = Object.fromEntries(Object.entries(earned).filter(([id]) => !data.badges[id]));
        saveBadges(user.uid, fresh).catch((err) => console.error("Couldn't save badges", err));
        setState({ status: "ready", data: { ...data, badges: withSaved(earned, data.badges) } });
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
        <Link href="/account" prefetch={false} className={linkClass}>Sign in</Link> to save and see your progress.
      </Message>
    );
  }
  if (state.status === "failed") return <Message>Couldn&apos;t load your progress. Check your connection and try again.</Message>;
  return <Stats data={state.data} wordLists={wordLists} />;
}

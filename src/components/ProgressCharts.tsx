"use client";

import { useState } from "react";
import { FEW_ANSWERS, FEW_REVIEWS, accuracy, answered, calendarWeeks, type CalendarDay, type Tally } from "@/lib/progress";

// About as far back as loadProgress reads days.
const CALENDAR_WEEKS = 17;
const ROW_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

// One hue, light to dark with the number of questions. Dark mode runs the other way, so more still stands out.
const LEVELS = [
  { min: 60, cls: "bg-accent-700 dark:bg-accent-300" },
  { min: 30, cls: "bg-accent-500 dark:bg-accent-500" },
  { min: 10, cls: "bg-accent-300 dark:bg-accent-700" },
  { min: 1, cls: "bg-accent-200 dark:bg-accent-900" },
];
const EMPTY = "bg-stone-200/70 dark:bg-stone-800";

const levelClass = (n: number) => LEVELS.find((l) => n >= l.min)?.cls ?? EMPTY;

/** Answers that count toward a percentage: accent slips are left out of accuracy. */
const graded = (t: Tally) => t.right + t.wrong;

const dateLabel = (day: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
};

const describe = (d: CalendarDay) => `${dateLabel(d.day)}: ${d.answered === 0 ? "no practice" : `${d.answered.toLocaleString()} ${d.answered === 1 ? "question" : "questions"}`}`;

export function PracticeCalendar({ days, today }: { days: Record<string, Tally>; today: string }) {
  const weeks = calendarWeeks(days, today, CALENDAR_WEEKS);
  const all = weeks.flat().filter((d) => !d.future);
  const practicedDays = all.filter((d) => d.answered > 0).length;
  const [hovered, setHovered] = useState<CalendarDay | null>(null);

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex gap-0.75 overflow-x-auto" onMouseLeave={() => setHovered(null)}>
        <div className="hidden shrink-0 flex-col gap-0.75 pr-1 text-[10px] leading-3.5 text-stone-500 sm:flex">
          {ROW_LABELS.map((label, i) => (
            <span key={i} className="h-3.5">
              {label}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0].day} className="flex shrink-0 flex-col gap-0.75">
            {week.map((d) =>
              d.future ? (
                <span key={d.day} className="size-3.5" />
              ) : (
                <span
                  key={d.day}
                  title={describe(d)}
                  onMouseEnter={() => setHovered(d)}
                  onClick={() => setHovered(d)}
                  className={`size-3.5 rounded-[3px] ${levelClass(d.answered)} ${d.day === today ? "ring-2 ring-stone-400 ring-offset-1 ring-offset-white dark:ring-stone-500 dark:ring-offset-stone-900" : ""}`}
                />
              ),
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-stone-500">
        <p aria-live="polite">{hovered ? describe(hovered) : `Practiced on ${practicedDays} of the last ${all.length} days`}</p>
        <p className="flex items-center gap-1 text-xs">
          Less
          {[EMPTY, ...LEVELS.map((l) => l.cls).reverse()].map((cls) => (
            <span key={cls} aria-hidden className={`size-3 rounded-[3px] ${cls}`} />
          ))}
          More
        </p>
      </div>
    </div>
  );
}

/**
 * One tense's weekly accuracy as a small line for a table row, oldest week first, always on a 0 to 100% scale so rows
 * compare fairly. Quiet weeks get a hollow marker, and each week has a hover label. Needs two weeks with answers.
 */
export function Sparkline({ weeks, few, label }: { weeks: Tally[]; few: number; label: string }) {
  // Starts at the first week with answers, so a tense begun recently fills the width instead of crowding the right edge.
  const oldest = weeks.findLastIndex((t) => answered(t) > 0);
  const span = weeks.slice(0, oldest + 1);
  const points = [...span].reverse().map((tally, i) => ({ i, tally, value: accuracy(tally), ago: span.length - 1 - i }));
  const shown = points.filter((p) => p.value !== null);
  if (shown.length < 2) return <span className="text-sm text-stone-500">Needs 2 weeks</span>;
  const x = (i: number) => (points.length === 1 ? 50 : (i / (points.length - 1)) * 100);
  const y = (v: number) => 100 - v;
  const weekName = (ago: number) => (ago === 0 ? "Last 7 days" : ago === 1 ? "1 week ago" : `${ago} weeks ago`);
  const runs: (typeof points)[] = [[]];
  for (const p of points) {
    if (p.value === null) runs.push([]);
    else runs[runs.length - 1].push(p);
  }
  return (
    <span role="img" aria-label={`${label}, weekly accuracy, oldest first: ${shown.map((p) => `${p.value}%`).join(", ")}`} className="relative ml-auto block h-7 w-28">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <line x1="0" x2="100" y1="50" y2="50" className="stroke-stone-200 dark:stroke-stone-700" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {runs
          .filter((r) => r.length > 1)
          .map((r) => (
            <polyline
              key={r[0].i}
              points={r.map((p) => `${x(p.i)},${y(p.value!)}`).join(" ")}
              fill="none"
              className="stroke-accent-600"
              strokeWidth="2"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
      </svg>
      {shown.map((p) => (
        <span
          key={p.i}
          title={`${weekName(p.ago)}: ${p.value}% of ${answered(p.tally).toLocaleString()}${graded(p.tally) < few ? " (a quiet week)" : ""}`}
          style={{ left: `${x(p.i)}%`, top: `${y(p.value!)}%` }}
          className="absolute flex size-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-accent-600"
        >
          <span className={`block size-2 rounded-full ring-2 ring-white dark:ring-stone-900 ${graded(p.tally) < few ? "border-2 border-current bg-white dark:bg-stone-900" : "bg-current"}`} />
        </span>
      ))}
    </span>
  );
}

// The two series' colors, validated together for colorblind separation and contrast in both modes (dataviz checks):
// the page's teal accent at step 600, and a violet. Each also has its own marker shape, so color never works alone.
const SERIES_STYLE = {
  all: { text: "text-accent-600", stroke: "stroke-accent-600", marker: "rounded-full" },
  recall: { text: "text-[#6250d6] dark:text-[#9085e9]", stroke: "stroke-[#6250d6] dark:stroke-[#9085e9]", marker: "rotate-45 rounded-[2px]" },
} as const;

interface Series {
  key: keyof typeof SERIES_STYLE;
  name: string;
  /** What one answer is called in the hover text: questions, reviews. */
  unit: string;
  weeks: Tally[];
  /** Fewer graded answers than this in a week draws a hollow marker. */
  few: number;
}

/**
 * Weekly accuracy as lines, oldest week first. Weeks with no answers leave a gap, and quiet weeks get a hollow marker.
 * `recall` adds how often items that had come due were remembered. `levels` marks the weeks the level changed.
 */
export function AccuracyTrend({ weeks, recall, levels = [] }: { weeks: Tally[]; recall?: Tally[]; levels?: { ago: number; level: string }[] }) {
  const series: Series[] = [
    { key: "all" as const, name: "All questions", unit: "questions", weeks, few: FEW_ANSWERS },
    { key: "recall" as const, name: "Remembered on review", unit: "reviews", weeks: recall ?? [], few: FEW_REVIEWS },
  ].filter((s) => s.weeks.some((t) => answered(t) > 0));
  const plotted = series.map((s) => {
    const points = [...s.weeks].reverse().map((tally, i) => ({ i, tally, value: accuracy(tally), faint: graded(tally) < s.few }));
    // Consecutive weeks with answers are joined; an empty week breaks the line.
    const runs: (typeof points)[] = [[]];
    for (const p of points) {
      if (p.value === null) runs.push([]);
      else runs[runs.length - 1].push(p);
    }
    const shown = points.filter((p) => p.value !== null);
    return { ...s, points, runs, shown, last: shown[shown.length - 1] };
  });
  const [hovered, setHovered] = useState<number | null>(null);
  const x = (i: number) => (weeks.length === 1 ? 50 : (i / (weeks.length - 1)) * 100);
  const y = (v: number) => 100 - v;

  const changeIn = (ago: number) => levels.find((l) => l.ago === ago)?.level;
  const weekName = (ago: number) => (ago === 0 ? "Last 7 days" : ago === 1 ? "1 week ago" : `${ago} weeks ago`);
  const anyFaint = plotted.some((s) => s.shown.some((p) => p.faint));
  const describeWeek = (i: number) => {
    const ago = weeks.length - 1 - i;
    const parts = plotted.flatMap((s) => {
      const p = s.points[i];
      if (!p || p.value === null) return s.key === "all" ? ["no practice"] : [];
      const label = s.key === "all" ? `${p.value}% correct` : `remembered ${p.value}%`;
      return [`${label} of ${answered(p.tally).toLocaleString()} ${s.unit}${p.faint ? " (a quiet week, so a rough number)" : ""}`];
    });
    return `${weekName(ago)}: ${parts.join(" · ")}` + (changeIn(ago) ? `, level set to ${changeIn(ago)}` : "");
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      {plotted.length > 1 && (
        <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600 dark:text-stone-400" aria-label="Legend">
          {plotted.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden className={`relative flex h-2.5 w-5 items-center ${SERIES_STYLE[s.key].text}`}>
                <span className="h-0.5 w-full bg-current" />
                <span className={`absolute left-1/2 size-2 -translate-x-1/2 bg-current ${SERIES_STYLE[s.key].marker}`} />
              </span>
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <div className="flex h-40 flex-col justify-between py-0 text-right text-xs tabular-nums text-stone-500" aria-hidden>
          <span className="-translate-y-1/2">100%</span>
          <span>50%</span>
          <span className="translate-y-1/2">0%</span>
        </div>
        <div className="relative h-40 flex-1" onMouseLeave={() => setHovered(null)}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            {[0, 50, 100].map((v) => (
              <line key={v} x1="0" x2="100" y1={y(v)} y2={y(v)} className="stroke-stone-200 dark:stroke-stone-700" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            {plotted.flatMap((s) =>
              s.runs
                .filter((r) => r.length > 1)
                .map((r) => (
                  <polyline
                    key={`${s.key}-${r[0].i}`}
                    points={r.map((p) => `${x(p.i)},${y(p.value!)}`).join(" ")}
                    fill="none"
                    className={SERIES_STYLE[s.key].stroke}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )),
            )}
            {levels.map((l) => (
              <line
                key={l.ago}
                x1={x(weeks.length - 1 - l.ago)}
                x2={x(weeks.length - 1 - l.ago)}
                y1="0"
                y2="100"
                className="stroke-accent-400 dark:stroke-accent-600"
                strokeWidth="1"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {hovered !== null && <line x1={x(hovered)} x2={x(hovered)} y1="0" y2="100" className="stroke-stone-300 dark:stroke-stone-600" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
          </svg>
          {levels.map((l) => (
            <span
              key={l.ago}
              aria-hidden
              style={{ left: `${x(weeks.length - 1 - l.ago)}%` }}
              className="absolute -top-5 -translate-x-1/2 rounded bg-accent-100 px-1 text-[10px] font-semibold leading-4 text-accent-800 dark:bg-accent-900 dark:text-accent-200"
            >
              {l.level}
            </span>
          ))}
          {plotted.flatMap((s) =>
            s.shown.map((p) => (
              // The wrapper places and scales the marker; the inner span is the shape, so a diamond's rotation stays put.
              <span
                key={`${s.key}-${p.i}`}
                aria-hidden
                style={{ left: `${x(p.i)}%`, top: `${y(p.value!)}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 transition-transform ${SERIES_STYLE[s.key].text} ${hovered === p.i ? "scale-150" : ""}`}
              >
                <span
                  className={`block size-2.5 ring-2 ring-white dark:ring-stone-900 ${SERIES_STYLE[s.key].marker} ${p.faint ? "border-2 border-current bg-white dark:bg-stone-900" : "bg-current"}`}
                />
              </span>
            )),
          )}
          {/* Each line's latest value, the first above its point and the second below, so they don't collide. */}
          {hovered === null &&
            plotted.map(
              (s, n) =>
                s.last && (
                  <span
                    key={s.key}
                    style={{ left: `${x(s.last.i)}%`, top: `${y(s.last.value!)}%` }}
                    className={`absolute -translate-x-full pr-1.5 text-sm font-semibold tabular-nums text-stone-800 dark:text-stone-200 ${n === 0 ? "translate-y-[-160%]" : "translate-y-[40%]"}`}
                  >
                    {s.last.value}%
                  </span>
                ),
            )}
          {/* Hover targets: a full-height column centered on each week, much wider than the dots. Tapping works too. */}
          {weeks.map((_, i) => (
            <span
              key={i}
              style={{ left: `${x(i)}%`, width: `${100 / Math.max(1, weeks.length - 1)}%` }}
              className="absolute inset-y-0 -translate-x-1/2"
              onMouseEnter={() => setHovered(i)}
              onClick={() => setHovered(i)}
            />
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between pl-10 text-xs text-stone-500">
        <span>{weeks.length - 1} weeks ago</span>
        <span>Last 7 days</span>
      </div>
      <p className="mt-2 min-h-5 text-sm text-stone-600 dark:text-stone-400" aria-live="polite">
        {hovered !== null
          ? describeWeek(hovered)
          : [
              "Share answered correctly each week, leaving accent slips out.",
              plotted.length > 1 && "Remembered on review is how often something you'd learned was right when it came back due.",
              anyFaint && "Hollow markers are quiet weeks, too few answers to read much into.",
              levels.length > 0 && "Dashed lines mark a change of level.",
              "Hover a week for details.",
            ]
              .filter(Boolean)
              .join(" ")}
      </p>
    </div>
  );
}

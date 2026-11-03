"use client";

import { useState } from "react";
import { accuracy, answered, calendarWeeks, type CalendarDay, type Tally } from "@/lib/progress";

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

/** Weekly accuracy as a line, oldest week first. Weeks with no answers leave a gap. */
export function AccuracyTrend({ weeks }: { weeks: Tally[] }) {
  const points = [...weeks].reverse().map((tally, i) => ({ i, tally, value: accuracy(tally), ago: weeks.length - 1 - i }));
  const [hovered, setHovered] = useState<number | null>(null);
  const x = (i: number) => (weeks.length === 1 ? 50 : (i / (weeks.length - 1)) * 100);
  const y = (v: number) => 100 - v;

  // Consecutive weeks with answers are joined; an empty week breaks the line.
  const runs: (typeof points)[] = [[]];
  for (const p of points) {
    if (p.value === null) runs.push([]);
    else runs[runs.length - 1].push(p);
  }
  const shown = points.filter((p) => p.value !== null);
  const last = shown[shown.length - 1];
  const active = hovered === null ? null : points[hovered];
  const weekName = (ago: number) => (ago === 0 ? "Last 7 days" : ago === 1 ? "1 week ago" : `${ago} weeks ago`);

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
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
            {runs
              .filter((r) => r.length > 1)
              .map((r) => (
                <polyline
                  key={r[0].i}
                  points={r.map((p) => `${x(p.i)},${y(p.value!)}`).join(" ")}
                  fill="none"
                  className="stroke-accent-600 dark:stroke-accent-400"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            {active && <line x1={x(active.i)} x2={x(active.i)} y1="0" y2="100" className="stroke-stone-300 dark:stroke-stone-600" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
          </svg>
          {shown.map((p) => (
            <span
              key={p.i}
              aria-hidden
              style={{ left: `${x(p.i)}%`, top: `${y(p.value!)}%` }}
              className={`absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-600 ring-2 ring-white dark:bg-accent-400 dark:ring-stone-900 ${hovered === p.i ? "scale-150" : ""} transition-transform`}
            />
          ))}
          {last && hovered === null && (
            <span
              style={{ left: `${x(last.i)}%`, top: `${y(last.value!)}%` }}
              className="absolute -translate-x-full translate-y-[-160%] pr-1 text-sm font-semibold tabular-nums text-stone-800 dark:text-stone-200"
            >
              {last.value}%
            </span>
          )}
          {/* Hover targets: a full-height column centered on each week, much wider than the dots. Tapping works too. */}
          {points.map((p) => (
            <span
              key={p.i}
              style={{ left: `${x(p.i)}%`, width: `${100 / Math.max(1, weeks.length - 1)}%` }}
              className="absolute inset-y-0 -translate-x-1/2"
              onMouseEnter={() => setHovered(p.i)}
              onClick={() => setHovered(p.i)}
            />
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between pl-10 text-xs text-stone-500">
        <span>{weeks.length - 1} weeks ago</span>
        <span>Last 7 days</span>
      </div>
      <p className="mt-2 min-h-5 text-sm text-stone-600 dark:text-stone-400" aria-live="polite">
        {active
          ? `${weekName(active.ago)}: ${active.value === null ? "no practice" : `${active.value}% correct of ${answered(active.tally).toLocaleString()} questions`}`
          : "Share answered fully correctly each week. Hover a week for details."}
      </p>
    </div>
  );
}

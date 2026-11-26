"use client";

import Link from "next/link";
import { MAX_PRACTICE_ITEMS, practiceHref, verbTenseTarget, type PracticeTarget } from "@/lib/practice";
import { accuracy, answered, type Tally } from "@/lib/progress";
import { describeItem, timesText, type Struggle } from "@/lib/struggles";

const linkClass = "flex min-h-10 items-center text-sm font-medium text-accent-700 underline dark:text-accent-400";

/**
 * A practice link. Inside a drill on /drill, `onPractice` starts the session in place, since /drill only reads its
 * address on arrival. Elsewhere it's a plain link to /drill.
 */
function PracticeLink({ target, label, onPractice }: { target: PracticeTarget; label: string; onPractice?: (target: PracticeTarget) => void }) {
  if (onPractice) {
    return (
      <button type="button" onClick={() => onPractice(target)} className={linkClass}>
        {label}
      </button>
    );
  }
  return (
    <Link href={practiceHref(target)} className={linkClass}>
      {label}
    </Link>
  );
}

const verbDetail = (t: Tally) => `${accuracy(t)}% correct of ${answered(t).toLocaleString()}`;
const itemDetail = (t: Tally) => `${t.right.toLocaleString()} right, ${t.wrong.toLocaleString()} wrong`;

/** Verbs first, each with its own practice link, then words and verb tenses with one link for all of them. */
export default function StruggleList({
  verbs,
  items,
  practiceItems = items,
  onPractice,
}: {
  verbs: { verb: string; tally: Tally }[];
  items: Struggle[];
  /** What the shared practice link covers, when that's more than the rows shown (a collapsed list). */
  practiceItems?: Struggle[];
  onPractice?: (target: PracticeTarget) => void;
}) {
  if (verbs.length + items.length === 0) return null;
  return (
    <div className="space-y-2 text-left">
      <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
        {verbs.map(({ verb, tally }) => (
          <li key={verb} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
            <span>
              <span className="block">
                You seem to struggle with conjugating{" "}
                <span lang="es" className="font-semibold">
                  {verb}
                </span>
                .
              </span>
              <span className="block text-sm text-stone-500">{verbDetail(tally)}</span>
            </span>
            <PracticeLink target={{ verb }} label={`Practice ${verb}`} onPractice={onPractice} />
          </li>
        ))}
        {items.map(({ item, tally }) => {
          // A verb tense gets its own link, to a short drill on that verb in that tense. Words share the one below.
          const verbTense = verbTenseTarget(item);
          return (
            <li key={item} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
              <span>
                <span className="block">
                  You&apos;ve missed <span className="font-semibold">{describeItem(item)}</span> {timesText(tally.wrong)}.
                </span>
                <span className="block text-sm text-stone-500">{itemDetail(tally)}</span>
              </span>
              {verbTense && <PracticeLink target={verbTense} label={`Practice ${verbTense.verb}`} onPractice={onPractice} />}
            </li>
          );
        })}
      </ul>
      {practiceItems.length > 0 && (
        <PracticeLink
          target={{ items: practiceItems.map((s) => s.item) }}
          label={practiceItems.length === 1 ? "Practice it" : `Practice ${practiceItems.length > MAX_PRACTICE_ITEMS ? `the worst ${MAX_PRACTICE_ITEMS}` : `these ${practiceItems.length}`}`}
          onPractice={onPractice}
        />
      )}
    </div>
  );
}

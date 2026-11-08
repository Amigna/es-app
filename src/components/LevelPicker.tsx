"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useDrillSettings } from "@/lib/drill-settings";
import { TENSES } from "@/lib/conjugation/types";
import { chooseLevel, levelInfo, LEVELS, storedLevel, storedLevelAt, storeLevel, useLevel, type Level } from "@/lib/level";
import { beyondLevel, levelReadiness, levelSync, MIN_PER_TENSE, READY_ACCURACY, READY_ANSWERS } from "@/lib/level-up";
import { localDay, type Tally } from "@/lib/progress";
import { progressEnabled } from "@/lib/progress-queue";

const subscribe = () => () => {};
const onServer = () => false;

/** Sets the level and the drill's tenses and verbs to match. Resolves to false when it's only saved in this browser. */
function useSetLevel() {
  const [, update] = useDrillSettings();
  return async (id: Level) => {
    const info = LEVELS.find((l) => l.id === id)!;
    update({ tenses: info.tenses, pool: info.pool });
    try {
      await chooseLevel(id);
      return true;
    } catch (err) {
      // It's still saved in this browser.
      console.error("Couldn't save the level", err);
      return false;
    }
  };
}

/** Choosing a level also sets the drill's tenses and verbs to match it. */
export function LevelPicker({ onChosen }: { onChosen?: () => void }) {
  const level = useLevel();
  const setLevel = useSetLevel();
  const [failed, setFailed] = useState(false);

  async function pick(id: Level) {
    setFailed(false);
    onChosen?.();
    setFailed(!(await setLevel(id)));
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            type="button"
            aria-pressed={level === l.id}
            onClick={() => pick(l.id)}
            className={`rounded-lg border px-3 py-2 text-left transition ${
              level === l.id ? "border-accent-600 bg-accent-50 dark:bg-accent-950" : "border-stone-200 hover:border-accent-600 dark:border-stone-800"
            }`}
          >
            <span className="block font-medium">
              {l.name} <span className="text-sm font-normal text-stone-500">{l.id}</span>
            </span>
            <span className="block text-sm text-stone-500">{l.hint}</span>
          </button>
        ))}
      </div>
      {failed && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Saved on this device, but couldn&apos;t save it to your account. Check your connection and choose again.
        </p>
      )}
    </div>
  );
}

/**
 * After passing a level's course exam, asks whether to set that as the level, when the saved one is lower or
 * missing. Asked, not done, because the level also resets the drill's tenses and verbs.
 */
export function LevelUpOffer({ to }: { to: Level }) {
  const level = useLevel();
  const setLevel = useSetLevel();
  const [answer, setAnswer] = useState<"pending" | "moved" | "failed" | "later">("pending");
  const info = LEVELS.find((l) => l.id === to)!;
  const below = !level || LEVELS.findIndex((l) => l.id === level) < LEVELS.findIndex((l) => l.id === to);
  if (answer === "later" || (answer === "pending" && !below)) return null;
  if (answer !== "pending") {
    return (
      <p role="status" className="text-sm">
        {answer === "moved"
          ? `Your level is now ${info.name} (${to}). Drills start with its tenses and words.`
          : "Saved on this device, but couldn't save it to your account. Check your connection and change it on the Drills page."}
      </p>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-accent-300 p-3 dark:border-accent-800">
      <p>
        You&apos;ve passed the {info.name.toLowerCase()} ({to}) exam. Set your level to {to}? Drills will start with its tenses, verbs and
        words.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={async () => setAnswer((await setLevel(to)) ? "moved" : "failed")}
          className="h-10 rounded-xl bg-accent-700 px-4 font-medium text-white transition hover:bg-accent-800"
        >
          Set my level to {to}
        </button>
        <button type="button" onClick={() => setAnswer("later")} className="h-10 px-2 text-sm text-accent-700 underline dark:text-accent-400">
          Not now
        </button>
      </div>
    </div>
  );
}

const tenseName = (id: string) => TENSES.find((t) => t.id === id)!.name.toLowerCase();

/** "present", "present and preterite", "present, preterite and imperfect". */
const listed = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

const LATER_KEY = "level-up-later";
const LATER_DAYS = 14;

/** "Not now" hides the suggestion for this level for a couple of weeks. Only this browser. */
function laterUntil(level: Level): string | null {
  try {
    const [saved, until] = (localStorage.getItem(LATER_KEY) ?? "").split("|");
    return saved === level ? until : null;
  } catch {
    return null;
  }
}

/**
 * The /progress line on how close the level's tenses are to the next level, and the offer to move up once they're
 * there. Moving up sets the drill's tenses and verbs, like choosing the level on the Drills page.
 */
export function LevelSuggestion({ days }: { days: Record<string, { tenses?: Record<string, Tally> }> }) {
  const level = useLevel();
  const setLevel = useSetLevel();
  const [answer, setAnswer] = useState<"pending" | "moved" | "failed" | "later">("pending");
  const today = localDay();
  if (!level) return null;
  const readiness = levelReadiness(days, level);
  // After moving up this is already the new level.
  const info = levelInfo(level);

  if (answer === "moved" || answer === "failed") {
    return (
      <p role="status">
        {answer === "moved"
          ? `Your level is now ${info.name} (${level}). Drills start with its tenses, verbs and words.`
          : "Saved on this device, but couldn't save it to your account. Check your connection and change it on the Drills page."}
      </p>
    );
  }
  if (!readiness) return <p className="text-stone-600 dark:text-stone-400">You&apos;re at {info.name} ({level}), the top level. Every tense and verb is in your drills.</p>;

  const next = levelInfo(readiness.next);
  const beyond = beyondLevel(days, level);
  const ahead = beyond.ahead;
  const until = laterUntil(level);
  const offering = (readiness.ready || ahead) && answer !== "later" && !(until && until >= today);
  if (offering) {
    return (
      <div className="space-y-3 rounded-xl border border-accent-300 bg-white p-4 dark:border-accent-800 dark:bg-stone-900">
        {readiness.ready ? (
          <p>
            You&apos;re getting {readiness.accuracy}% right in the {info.name.toLowerCase()} ({level}) tenses over your last{" "}
            {readiness.answered.toLocaleString()} answers. Ready for {next.name.toLowerCase()} ({next.id})? Drills would start with its tenses,
            verbs and words. You can always change back on the Drills page.
          </p>
        ) : (
          // Drilling above the level and doing well: a hint, so it only ever offers the next level, not the one they're managing.
          <p>
            You&apos;re getting {ahead!.accuracy}% right in {ahead!.level} tenses like the {tenseName(ahead!.tense)} ({ahead!.answered.toLocaleString()}{" "}
            answers lately), above your level of {info.name.toLowerCase()} ({level}). If {level} feels easy, try {next.name.toLowerCase()} ({next.id}):
            drills would start with its tenses, verbs and words. You can always change back on the Drills page.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={async () => setAnswer((await setLevel(next.id)) ? "moved" : "failed")}
            className="h-10 rounded-xl bg-accent-700 px-4 font-medium text-white transition hover:bg-accent-800"
          >
            Move up to {next.id}
          </button>
          <button
            type="button"
            onClick={() => {
              const [y, m, d] = today.split("-").map(Number);
              try {
                localStorage.setItem(LATER_KEY, `${level}|${localDay(new Date(y, m - 1, d + LATER_DAYS))}`);
              } catch {
                // Hidden for this visit only.
              }
              setAnswer("later");
            }}
            className="h-10 px-2 text-sm text-accent-700 underline dark:text-accent-400"
          >
            Not now
          </button>
        </div>
      </div>
    );
  }

  const thin = readiness.thin.map(tenseName);
  const own = info.tenses.map(tenseName);
  const counted = own.length === 1 ? `${own[0]}-tense answers count` : own.length <= 3 ? `${listed(own)} answers count` : `answers in the ${level} tenses count`;
  return (
    <div className="space-y-1 text-stone-600 dark:text-stone-400">
      <p>
        {readiness.answered === 0
          ? `Toward ${next.name.toLowerCase()} (${next.id}): this starts counting with your next conjugation or fill-in-the-blank answers${beyond.outside > 0 ? ` in the ${level} tenses` : ""}.`
          : `Toward ${next.name.toLowerCase()} (${next.id}): ${readiness.accuracy ?? 0}% right over your last ${readiness.answered.toLocaleString()} answers in the ${level} tenses.` +
            (readiness.ready ? "" : ` It's suggested at ${READY_ACCURACY}% over ${READY_ANSWERS} answers.`)}
      </p>
      {beyond.outside > 0 && (
        <p className="text-sm">
          Only {counted} toward {next.id} at your level. {beyond.outside.toLocaleString()} of your last {beyond.answered.toLocaleString()} answers
          were in other tenses.
          {ahead && ` Those are going well too: ${ahead.accuracy}% right in ${ahead.level} tenses.`}
        </p>
      )}
      {/* With one tense, like A1, the answer count already says it. */}
      {readiness.answered > 0 && thin.length > 0 && own.length > 1 && (
        <p className="text-sm">
          Each tense needs at least {MIN_PER_TENSE} of those answers. Still to practice: {thin.join(", ")}.
        </p>
      )}
      {readiness.ready && <p className="text-sm">Ready for {next.id} whenever you are: change your level on the Drills page.</p>}
    </div>
  );
}

/** Once per page load: the prompt moves between the drill page and the rest, and one check is enough. */
let synced: Promise<void> | null = null;

/**
 * Makes this browser and the account agree on the level, the newer one winning, so a change on one device reaches the
 * others. A level taken from the account also sets the drill's tenses and verbs, as choosing it here would.
 */
async function syncLevel(applyToDrill: (level: Level) => void) {
  const { loadLevel, saveLevel } = await import("@/lib/progress-store");
  const saved = await loadLevel();
  const local = { level: storedLevel(), at: storedLevelAt() };
  const action = levelSync(local, saved);
  if (action === "take" && saved) {
    if (saved.level !== local.level) applyToDrill(saved.level);
    storeLevel(saved.level, saved.at);
  }
  // Chosen here while signed out, or a save that didn't get through.
  if (action === "send" && local.level) await saveLevel(local.level, local.at);
}

/**
 * Asks for a level when there isn't one. Signed-in people are asked on every page, after checking their account, which
 * may have one from another device. Signed-out people only on the drill setup (`everyone`). Firebase is only loaded for
 * signed-in people.
 */
export function LevelPrompt({ everyone = false, className = "" }: { everyone?: boolean; className?: string }) {
  const level = useLevel();
  const signedIn = useSyncExternalStore(subscribe, progressEnabled, onServer);
  const [, update] = useDrillSettings();
  const [checked, setChecked] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    synced ??= syncLevel((id) => {
      const info = LEVELS.find((l) => l.id === id)!;
      update({ tenses: info.tenses, pool: info.pool });
    }).catch((err) => console.error("Couldn't sync the level", err));
    synced.finally(() => {
      if (current) setChecked(true);
    });
    return () => {
      current = false;
    };
    // `update` changes identity with the settings; the sync only needs to start once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  if (level || dismissed || !(signedIn ? checked : everyone)) return null;

  return (
    <section
      aria-labelledby="level-prompt"
      className={`space-y-3 rounded-xl border border-accent-300 bg-white p-4 dark:border-accent-800 dark:bg-stone-900 ${className}`}
    >
      <div>
        <h2 id="level-prompt" className="text-xl font-semibold">
          How much Spanish do you know?
        </h2>
        <p className="text-sm text-stone-500">
          Drills start with the tenses, verbs and words for your level. You can still pick anything, and change your level on the Drills page.
        </p>
      </div>
      <LevelPicker />
      <button type="button" onClick={() => setDismissed(true)} className="min-h-10 text-sm text-accent-700 underline dark:text-accent-400">
        Not now
      </button>
    </section>
  );
}

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useDrillSettings } from "@/lib/drill-settings";
import { chooseLevel, LEVELS, storedLevel, storeLevel, useLevel, type Level } from "@/lib/level";
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

/**
 * Asks for a level when there isn't one. Signed-in people are asked on every page, after checking their account, which
 * may have one from another device. Signed-out people only on the drill setup (`everyone`). Firebase is only loaded for
 * signed-in people.
 */
export function LevelPrompt({ everyone = false, className = "" }: { everyone?: boolean; className?: string }) {
  const level = useLevel();
  const signedIn = useSyncExternalStore(subscribe, progressEnabled, onServer);
  const [checked, setChecked] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!signedIn || storedLevel()) return;
    let current = true;
    import("@/lib/progress-store")
      .then(({ loadLevel }) => loadLevel())
      .then((saved) => {
        if (saved && !storedLevel()) storeLevel(saved);
      })
      .catch((err) => console.error("Couldn't load the level", err))
      .finally(() => {
        if (current) setChecked(true);
      });
    return () => {
      current = false;
    };
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

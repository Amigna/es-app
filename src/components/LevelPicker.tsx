"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useDrillSettings } from "@/lib/drill-settings";
import { chooseLevel, LEVELS, storedLevel, storeLevel, useLevel, type Level } from "@/lib/level";
import { progressEnabled } from "@/lib/progress-queue";

const subscribe = () => () => {};
const onServer = () => false;

/** Choosing a level also sets the drill's tenses and verbs to match it. */
export function LevelPicker({ onChosen }: { onChosen?: () => void }) {
  const level = useLevel();
  const [, update] = useDrillSettings();
  const [failed, setFailed] = useState(false);

  async function pick(id: Level) {
    const info = LEVELS.find((l) => l.id === id)!;
    update({ tenses: info.tenses, pool: info.pool });
    setFailed(false);
    onChosen?.();
    try {
      await chooseLevel(id);
    } catch (err) {
      // It's still saved in this browser.
      console.error("Couldn't save the level", err);
      setFailed(true);
    }
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

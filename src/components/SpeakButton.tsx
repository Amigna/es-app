"use client";

import { useSyncExternalStore } from "react";
import { canSpeak, speak, subscribeToVoices } from "@/lib/speech";

const onServer = () => false;

/** Reads Spanish aloud. Hidden on devices with no Spanish voice. */
export default function SpeakButton({ text }: { text: string }) {
  const available = useSyncExternalStore(subscribeToVoices, canSpeak, onServer);
  if (!available) return null;

  return (
    <button
      type="button"
      onClick={() => speak(text)}
      aria-label={`Listen: ${text}`}
      title="Listen"
      className="-my-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-stone-400 transition hover:text-accent-700 dark:text-stone-500 dark:hover:text-accent-400"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
      >
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  );
}

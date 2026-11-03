"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { progressEnabled } from "@/lib/progress-queue";

// These match the limits in firestore.rules.
const MAX_ABOUT = 300;
const MAX_MESSAGE = 500;
const MAX_PAGE = 200;

const subscribe = () => () => {};
const onServer = () => false;

/** A link to flag a mistake, shown to invited people. `about` tells you which word or sentence it was. */
export default function ReportProblem({ about }: { about: string }) {
  const invited = useSyncExternalStore(subscribe, progressEnabled, onServer);
  const id = useId();
  const [state, setState] = useState<"closed" | "open" | "sending" | "failed" | "sent">("closed");
  const [message, setMessage] = useState("");
  const text = message.trim();

  async function send() {
    setState("sending");
    try {
      const { sendReport } = await import("@/lib/report");
      await sendReport(about.slice(0, MAX_ABOUT), text, window.location.pathname.slice(0, MAX_PAGE));
      setState("sent");
    } catch (err) {
      console.error("Report failed", err);
      setState("failed");
    }
  }

  if (!invited) return null;

  if (state === "sent") {
    return (
      <p role="status" className="mt-2 text-sm text-stone-500">
        Thanks, your report was sent.
      </p>
    );
  }

  if (state === "closed") {
    return (
      <button
        type="button"
        onClick={() => setState("open")}
        aria-label={`Report a problem with ${about.slice(0, 80)}`}
        className="-mb-2 ml-auto mt-auto flex min-h-10 w-fit items-center gap-1 pt-1 text-xs text-stone-400 transition hover:text-accent-700 dark:text-stone-500 dark:hover:text-accent-400"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3"
        >
          <path d="M5 22V4c4-2.5 7 2.5 14 0v10c-7 2.5-10-2.5-14 0" />
        </svg>
        Report a problem
      </button>
    );
  }

  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label htmlFor={id} className="block text-sm text-stone-500">
        What&apos;s wrong?
      </label>
      <textarea
        id={id}
        autoFocus
        required
        rows={2}
        maxLength={MAX_MESSAGE}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base outline-none transition focus:border-accent-600 focus:ring-2 focus:ring-accent-600/30 dark:border-stone-700 dark:bg-stone-950"
      />
      {state === "failed" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t send that. Check your connection and try again.
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={state === "sending" || !text}
          className="min-h-10 rounded-lg bg-accent-700 px-4 text-sm font-medium text-white transition hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
        <button
          type="button"
          onClick={() => setState("closed")}
          className="min-h-10 rounded-lg border border-stone-300 px-4 text-sm transition hover:border-accent-600 dark:border-stone-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TENSES } from "@/lib/conjugation/types";
import { useDrillSettings } from "@/lib/drill-settings";
import { auth, firebaseConfigured, isInvited } from "@/lib/firebase";
import { accuracy, answered, currentStreak, lastSevenDays, localDay } from "@/lib/progress";
import { saveProgress, setProgressEnabled } from "@/lib/progress-queue";
import { loadProgress, type ProgressData } from "@/lib/progress-store";
import { MASTERED_DAYS } from "@/lib/schedule";

const SAVE_WAIT_MS = 5000;

type State =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "notInvited" }
  | { status: "failed" }
  | { status: "ready"; data: ProgressData };

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      {note && <p className="mt-1 text-sm text-zinc-500">{note}</p>}
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
      {children}
    </div>
  );
}

const linkClass = "text-emerald-700 underline dark:text-emerald-400";

function Stats({ data }: { data: ProgressData }) {
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Current streak" value={`${streak} ${streak === 1 ? "day" : "days"}`} />
        <Tile label="Last 7 days" value={lastSevenDays(data.days, today).toLocaleString()} note="questions" />
        <Tile label="All time" value={total.toLocaleString()} note={overall === null ? undefined : `${overall}% correct`} />
        <Tile label="Mastered" value={data.mastered.toLocaleString()} note={`of ${data.practiced.toLocaleString()} practiced`} />
      </div>

      {tenseRows.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Accuracy by tense</h2>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-200 text-sm text-zinc-500 dark:border-zinc-800">
                  <th scope="col" className="px-4 py-2 font-medium">Tense</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Answered</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Correct</th>
                </tr>
              </thead>
              <tbody>
                {tenseRows.map(({ meta, tally }) => (
                  <tr key={meta.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
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
        <p className="text-zinc-600 dark:text-zinc-400">Accuracy by tense shows up after a conjugation or fill-in-the-blank drill.</p>
      )}

      <p className="text-sm text-zinc-500">
        Correct means fully right, so accent slips aren&apos;t included. Mastered means you&apos;re expected to remember it for at
        least {MASTERED_DAYS} days, and only the first try at a question counts.
      </p>
    </div>
  );
}

export default function ProgressView() {
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
  if (state.status === "loading") return <p className="text-zinc-500">Loading…</p>;
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
  return <Stats data={state.data} />;
}

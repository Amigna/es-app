"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import SpeakButton from "@/components/SpeakButton";
import { progressEnabled } from "@/lib/progress-queue";
import { tokenize } from "@/lib/readings";
import type { LookupMatch } from "@/lib/word-lookup";

const subscribe = () => () => {};
const onServer = () => false;

interface Picked {
  paragraph: number;
  token: number;
  word: string;
}

/** Null until loaded, and stays null for people without saved progress. */
type ReviewState = { seen: Set<string>; wanted: Set<string> } | null;

/** Firebase stays out of this page's bundle, so it only loads for invited people who tap a word. */
async function loadReviewState(): Promise<ReviewState> {
  const { loadReviewState } = await import("@/lib/progress-store");
  const state = await loadReviewState();
  return state && { seen: new Set(state.seen), wanted: new Set(state.wanted) };
}

function AddButton({ match, review, onAdded }: { match: LookupMatch; review: ReviewState; onAdded: (item: string) => void }) {
  const [state, setState] = useState<"idle" | "saving" | "failed">("idle");
  if (!review) return null;
  if (review.seen.has(match.item)) return <p className="text-sm text-stone-500">Already in your reviews</p>;
  if (review.wanted.has(match.item)) {
    return (
      <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
        Added. It comes up as a new item in Today&apos;s review.
      </p>
    );
  }

  async function add() {
    setState("saving");
    try {
      const { addWanted } = await import("@/lib/progress-store");
      await addWanted(match.item);
      onAdded(match.item);
    } catch (err) {
      console.error("Couldn't add the word", err);
      setState("failed");
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={add}
        disabled={state === "saving"}
        className="min-h-10 rounded-lg bg-accent-700 px-4 text-sm font-medium text-white transition hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "saving" ? "Adding…" : "Add to my reviews"}
      </button>
      {state === "failed" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t add it. Check your connection and try again.
        </p>
      )}
    </div>
  );
}

/** The passage with every word tappable. A tap shows what the word is and, for invited people, adds it to their reviews. */
export default function ReadingPassage({ paragraphs, words }: { paragraphs: { es: string; en: string }[]; words: { es: string; en: string }[] }) {
  const invited = useSyncExternalStore(subscribe, progressEnabled, onServer);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [matches, setMatches] = useState<LookupMatch[] | null>(null);
  const [review, setReview] = useState<ReviewState>(null);
  const [reviewRequested, setReviewRequested] = useState(false);

  useEffect(() => {
    if (!picked) return;
    let current = true;
    import("@/lib/word-lookup").then(({ lookupWord }) => {
      if (current) setMatches(lookupWord(picked.word));
    });
    return () => {
      current = false;
    };
  }, [picked]);

  useEffect(() => {
    if (!picked) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setPicked(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [picked]);

  function pick(paragraph: number, token: number, word: string) {
    setMatches(null);
    setPicked(picked?.paragraph === paragraph && picked.token === token ? null : { paragraph, token, word });
    if (invited && !reviewRequested) {
      setReviewRequested(true);
      loadReviewState()
        .then(setReview)
        .catch((err) => console.error("Couldn't load your reviews", err));
    }
  }

  const story = picked && words.find((w) => w.es.toLowerCase() === picked.word.toLowerCase());

  return (
    <>
      <p className="text-sm text-stone-500">Tap any word to look it up.</p>
      {paragraphs.map((p, i) => (
        <div key={p.es}>
          <p lang="es" className="text-lg leading-relaxed">
            {tokenize(p.es).map((t, j) =>
              t.word ? (
                <span
                  key={j}
                  onClick={() => pick(i, j, t.text)}
                  className={`cursor-pointer rounded-sm transition hover:bg-accent-100 dark:hover:bg-accent-950 ${
                    picked?.paragraph === i && picked.token === j ? "bg-accent-200 dark:bg-accent-900" : ""
                  }`}
                >
                  {t.text}
                </span>
              ) : (
                t.text
              ),
            )}
          </p>
          <details className="text-stone-600 dark:text-stone-400">
            <summary className="w-fit cursor-pointer py-2.5 text-sm text-accent-700 dark:text-accent-400">Show English</summary>
            <p className="border-l-2 border-stone-300 pl-3 dark:border-stone-700">{p.en}</p>
          </details>
        </div>
      ))}

      {picked && (
        // Space at the bottom of the page so the panel never covers the last lines.
        <div aria-hidden className="h-56" />
      )}
      {picked && (
        <section
          aria-label={`About ${picked.word}`}
          className="animate-pop-in fixed inset-x-0 bottom-0 z-40 max-h-[60vh] overflow-y-auto border-t border-stone-200 bg-white px-4 pb-6 pt-4 shadow-lg dark:border-stone-800 dark:bg-stone-900"
        >
          <div className="mx-auto max-w-2xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1">
                <span lang="es" className="text-2xl font-semibold">
                  {picked.word}
                </span>
                <SpeakButton text={picked.word} />
              </p>
              <button
                type="button"
                onClick={() => setPicked(null)}
                aria-label="Close"
                className="inline-flex size-10 items-center justify-center rounded-full text-stone-500 transition hover:text-accent-700"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            {story && (
              <p className="text-stone-600 dark:text-stone-400">
                <span className="font-medium text-stone-800 dark:text-stone-200">In this story:</span> {story.en}
              </p>
            )}

            {matches === null ? (
              <p className="text-stone-500">Looking it up…</p>
            ) : matches.length === 0 ? (
              <p className="text-stone-600 dark:text-stone-400">
                {story ? "This form isn't in the word lists, so it can't be added to your reviews." : "Not in the word lists yet. It may be a name, or a form the lookup doesn't know."}
              </p>
            ) : (
              <ul className="space-y-3">
                {matches.map((m) => (
                  <li key={m.key} className="space-y-2 rounded-lg border border-stone-200 px-3 py-2 dark:border-stone-700">
                    <div>
                      <p>
                        <span lang="es" className="font-semibold text-accent-800 dark:text-accent-300">
                          {m.headword}
                        </span>{" "}
                        <span className="text-stone-600 dark:text-stone-400">{m.en}</span>
                      </p>
                      <p className="text-sm text-stone-500">{m.detail}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <AddButton match={m} review={review} onAdded={(item) => review && setReview({ ...review, wanted: new Set(review.wanted).add(item) })} />
                      {m.href && (
                        <Link href={m.href} className="text-sm text-accent-700 underline dark:text-accent-400">
                          See all forms
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {!invited && matches && matches.length > 0 && (
              <p className="text-sm text-stone-500">
                <Link href="/account" prefetch={false} className="text-accent-700 underline dark:text-accent-400">
                  Sign in
                </Link>{" "}
                to add words to your reviews. Saved progress is invite-only for now.
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}

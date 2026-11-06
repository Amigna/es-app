import type { Card } from "./drill";
import { quizPlace, type QuizSeen } from "./quiz";

// Which guide questions this browser asked most recently, so the next run starts with ones not seen lately. Kept per
// guide as question positions, most recent last. Only a convenience: without storage, runs are simply random.

const KEY = "quiz-seen";
/** More than any guide's quiz, so every question asked keeps its place. */
const KEEP = 80;

function read(): QuizSeen {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).flatMap(([slug, list]) =>
        Array.isArray(list) ? [[slug, list.filter((n): n is number => Number.isInteger(n))]] : [],
      ),
    );
  } catch {
    return {};
  }
}

export const quizSeen = read;

function remember(card: Card) {
  const place = quizPlace(card);
  if (!place) return;
  const [slug, index] = place;
  const seen = read();
  seen[slug] = [...(seen[slug] ?? []).filter((n) => n !== index), index].slice(-KEEP);
  try {
    localStorage.setItem(KEY, JSON.stringify(seen));
  } catch {
    // Private windows can refuse storage; the next run is just random.
  }
}

/** Notes each quiz question as it's dealt, so leaving early doesn't count the ones never shown. */
export function remembering(next: () => Card | null): () => Card | null {
  return () => {
    const card = next();
    if (card) remember(card);
    return card;
  };
}

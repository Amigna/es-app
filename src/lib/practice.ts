import { TENSES, type TenseId } from "./conjugation/types";
import type { VocabKind } from "./drill-settings";
import { accuracy, answered, type Tally } from "./progress";

// Finds what someone keeps missing, and links each one to a short drill. No Firebase here, so it's safe to load anywhere.

export type PracticeTarget = { tenses: TenseId[] } | { verb: string } | { kind: VocabKind };

export interface WeakSpot {
  key: string;
  label: string;
  detail: string;
  target: PracticeTarget;
}

export interface WeakSpots {
  tenses: WeakSpot[];
  verbs: WeakSpot[];
  mistakes: WeakSpot[];
}

interface Stats {
  total: Tally;
  tenses: Record<string, Tally>;
  verbs: Record<string, Tally>;
  kinds: Record<string, Tally>;
}

/** Enough answers that one bad day doesn't count as a weak spot. */
const MIN_ANSWERS = 5;
const WEAK_BELOW = 90;
const SHOWN = 5;
const MIN_ACCENT_SLIPS = 3;
const ACCENT_TENSES = 3;

const KIND_LABELS: Record<VocabKind, string> = {
  toSpanish: "English to Spanish",
  toEnglish: "Spanish to English",
  gender: "Noun gender",
  agreement: "Adjective agreement",
};

const KINDS = Object.keys(KIND_LABELS) as VocabKind[];

const detail = (tally: Tally) => `${accuracy(tally)}% correct of ${answered(tally).toLocaleString()}`;

/** Lowest accuracy first, and among ties, the one answered most. */
function weakest<T extends string>(tallies: Record<string, Tally>, known: (id: string) => id is T): [T, Tally][] {
  return Object.entries(tallies)
    .flatMap(([id, tally]): [T, Tally][] => (known(id) ? [[id, tally]] : []))
    .filter(([, tally]) => answered(tally) >= MIN_ANSWERS && (accuracy(tally) ?? 100) < WEAK_BELOW)
    .sort(([, a], [, b]) => (accuracy(a) ?? 0) - (accuracy(b) ?? 0) || answered(b) - answered(a))
    .slice(0, SHOWN);
}

const isTense = (id: string): id is TenseId => TENSES.some((t) => t.id === id);
const isKind = (id: string): id is VocabKind => KINDS.includes(id as VocabKind);
const anyId = (id: string): id is string => id.length > 0;

function accentSpot({ total, tenses }: Stats): WeakSpot[] {
  if (total.accent < MIN_ACCENT_SLIPS) return [];
  const worst = Object.entries(tenses)
    .flatMap(([id, tally]): [TenseId, number][] => (isTense(id) && tally.accent > 0 ? [[id, tally.accent]] : []))
    .sort(([, a], [, b]) => b - a)
    .slice(0, ACCENT_TENSES)
    .map(([id]) => id);
  if (worst.length === 0) return [];
  return [{ key: "accents", label: "Accent marks", detail: `${total.accent.toLocaleString()} slips`, target: { tenses: worst } }];
}

export function weakSpots(stats: Stats): WeakSpots {
  return {
    tenses: weakest(stats.tenses, isTense).map(([id, tally]) => ({
      key: id,
      label: TENSES.find((t) => t.id === id)!.name,
      detail: detail(tally),
      target: { tenses: [id] },
    })),
    verbs: weakest(stats.verbs, anyId).map(([inf, tally]) => ({ key: inf, label: inf, detail: detail(tally), target: { verb: inf } })),
    mistakes: [
      ...accentSpot(stats),
      ...weakest(stats.kinds, isKind).map(([kind, tally]) => ({ key: kind, label: KIND_LABELS[kind], detail: detail(tally), target: { kind } })),
    ],
  };
}

export function practiceHref(target: PracticeTarget): string {
  if ("verb" in target) return `/drill?verb=${encodeURIComponent(target.verb)}`;
  if ("kind" in target) return `/drill?kind=${target.kind}`;
  return `/drill?tenses=${target.tenses.join(",")}`;
}

/** Addresses can be old or hand-typed, so anything unrecognized means a normal visit to the drill page. */
export function parsePractice(search: string): PracticeTarget | null {
  const params = new URLSearchParams(search);
  const verb = params.get("verb");
  if (verb) return { verb };
  const kind = params.get("kind");
  if (kind && isKind(kind)) return { kind };
  const tenses = (params.get("tenses") ?? "").split(",").filter(isTense);
  return tenses.length > 0 ? { tenses } : null;
}

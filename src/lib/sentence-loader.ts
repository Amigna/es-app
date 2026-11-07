import type { SentenceBank } from "./sentences";
import { VERBS, findVerb, type Verb } from "./verbs";

// Sentences live in one file per 50 verbs, in the order of verbs.json, so a drill downloads only the files it uses.
// Each is its own chunk, so adding sentences to one file doesn't change the others.

export const VERBS_PER_FILE = 50;

const FILES: (() => Promise<{ default: unknown }>)[] = [
  () => import("../data/sentences/verbs-001-050.json"),
  () => import("../data/sentences/verbs-051-100.json"),
  () => import("../data/sentences/verbs-101-150.json"),
  () => import("../data/sentences/verbs-151-200.json"),
  () => import("../data/sentences/verbs-201-250.json"),
  () => import("../data/sentences/verbs-251-300.json"),
  () => import("../data/sentences/verbs-301-350.json"),
  () => import("../data/sentences/verbs-351-400.json"),
  () => import("../data/sentences/verbs-401-450.json"),
  () => import("../data/sentences/verbs-451-500.json"),
  () => import("../data/sentences/verbs-501-550.json"),
  () => import("../data/sentences/verbs-551-600.json"),
  () => import("../data/sentences/verbs-601-650.json"),
  () => import("../data/sentences/verbs-651-700.json"),
  () => import("../data/sentences/verbs-701-750.json"),
  () => import("../data/sentences/verbs-751-800.json"),
  () => import("../data/sentences/verbs-801-850.json"),
];

const positions = new Map(VERBS.map((v, i) => [v.inf, i]));

/** Which files hold these verbs. */
export function filesFor(verbs: Verb[]): number[] {
  const files = new Set(verbs.map((v) => Math.floor(positions.get(v.inf)! / VERBS_PER_FILE)));
  return [...files].sort((a, b) => a - b);
}

export async function loadSentences(verbs: Verb[]): Promise<SentenceBank> {
  const loaded = await Promise.all(filesFor(verbs).map((file) => FILES[file]()));
  return Object.assign({}, ...loaded.map((m) => m.default));
}

/** The verbs in a list of saved items like `verb:hablar:present`. */
export function itemVerbs(items: string[]): Verb[] {
  const infinitives = new Set(items.filter((item) => item.startsWith("verb:")).map((item) => item.split(":")[1]));
  return [...infinitives].map(findVerb).filter((v): v is Verb => !!v);
}

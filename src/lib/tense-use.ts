import { TENSES, type TenseId } from "./conjugation/types";

// How often each tense comes up in everyday Latin American Spanish, so the drill page can say what's worth focusing on.
// A judgment, not a count: speech and everyday writing, not literature or legal texts.

export type TenseUse = "everyday" | "common" | "less" | "rare";

export const USE_LABELS: Record<TenseUse, string> = {
  everyday: "Everyday",
  common: "Common",
  less: "Less common",
  rare: "Rare",
};

const RANK: Record<TenseUse, number> = { everyday: 0, common: 1, less: 2, rare: 3 };

/** `note` says what it's actually used for, where that changes what to focus on. */
export const TENSE_USE: Record<TenseId, { use: TenseUse; note?: string }> = {
  present: { use: "everyday" },
  preterite: { use: "everyday" },
  imperfect: { use: "everyday" },
  subjPresent: { use: "everyday", note: "Needed all the time: quiero que vengas, ojalá, para que." },
  impAffirmative: { use: "everyday" },
  impNegative: { use: "everyday" },
  future: { use: "common", note: "Plans usually take ir a + infinitive. This is for predictions, promises and guesses: ¿dónde estará?" },
  conditional: { use: "common" },
  presentPerfect: {
    use: "common",
    note: "Nunca he ido a Cuba. Used less in most of Latin America than in Spain; many people say the preterite instead: ya comí for ya he comido.",
  },
  pluperfect: { use: "common", note: "Common in stories, for what had already happened: cuando llegué, ya se había ido." },
  subjImperfect: { use: "common", note: "Si clauses and past wishes: si tuviera, quería que vinieras." },
  futurePerfect: { use: "less", note: "Mostly for guesses about the past: ya habrá llegado." },
  conditionalPerfect: { use: "less", note: "Mostly in si clauses about the past: habría ido." },
  subjPresentPerfect: { use: "less", note: "Worth knowing, but it comes up less: espero que hayas comido." },
  subjPluperfect: { use: "less", note: "Mostly in si clauses about the past: si hubiera sabido." },
  subjImperfectSe: { use: "rare", note: "Means the same as -ra, but it's mostly written or heard in Spain. Learn -ra first; recognizing -se is enough." },
};

/** Within a group of tenses, everyday ones first, keeping the usual order among equals. */
export function byUse(tenses: TenseId[]): TenseId[] {
  const order = TENSES.map((t) => t.id);
  return [...tenses].sort((a, b) => RANK[TENSE_USE[a].use] - RANK[TENSE_USE[b].use] || order.indexOf(a) - order.indexOf(b));
}

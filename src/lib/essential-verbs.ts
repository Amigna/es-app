import picks from "../data/essential-verbs.json";
import { VERBS, type Verb } from "./verbs";

// The home page's top block: the most common verbs, then everyday ones that rank lower in a written-text frequency
// order (comer, comprar, cantar). A list of its own, because reordering VERBS would move verbs between sentence files
// and change the order of new items in Today's review.

/** How many of the first verbs in VERBS are included, since VERBS runs from the most common down. */
export const COMMON_COUNT = 50;

const extra = new Set<string>(picks);

export const ESSENTIAL_VERBS: Verb[] = VERBS.filter((v, i) => i < COMMON_COUNT || extra.has(v.inf));

const essential = new Set(ESSENTIAL_VERBS);

export const OTHER_VERBS: Verb[] = VERBS.filter((v) => !essential.has(v));

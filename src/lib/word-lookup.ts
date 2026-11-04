import { stripAccents } from "./conjugation/accent";
import { conjugate } from "./conjugation/engine";
import { TENSES, type TenseId } from "./conjugation/types";
import { personLabel, verbTrack } from "./drill";
import { VERBS, verbSlug } from "./verbs";
import { ADJECTIVES, ADVERBS, NOUNS, SMALL_WORDS, adjectiveForms, nounArticle, nounPlural } from "./vocab";

// Finds a word tapped in a reading passage: which entry it belongs to, and the item to add to the review schedule.
// Imported on demand, because it pulls in the word lists and conjugates every verb.

export interface LookupMatch {
  key: string;
  /** The dictionary form: "la casa", "comer". */
  headword: string;
  en: string;
  /** What this spelling is: "Plural", "Preterite · yo". */
  detail: string;
  /** The saved item to put in Today's review. */
  item: string;
  href?: string;
}

interface VerbHit {
  inf: string;
  en: string;
  /** Tense and the persons using this spelling, in TENSES order. */
  uses: { tense: TenseId; persons: string[] }[];
  nonfinite: string[];
}

const FORM_NAMES = ["", "Feminine", "Plural", "Feminine plural"];
const REFLEXIVE = /^(?:me|te|se|nos) /;
const CLITIC = /(?:me|te|se|nos|lo|la|le|los|las|les)$/;

/** Single words only: a tap lands on one word. */
const oneWord = (s: string) => !/\s/.test(s);
const norm = (s: string) => s.toLowerCase();

interface Index {
  words: Map<string, LookupMatch[]>;
  verbs: Map<string, Map<string, VerbHit>>;
  /** Infinitives, gerunds and commands, with accents removed, for forms with pronouns attached: decirme, cómelo. */
  attachable: Map<string, Map<string, VerbHit>>;
}

function addWord(index: Index, spelling: string, match: LookupMatch) {
  if (!oneWord(spelling)) return;
  const list = index.words.get(norm(spelling)) ?? [];
  if (!list.some((m) => m.key === match.key)) list.push(match);
  index.words.set(norm(spelling), list);
}

function verbHit(map: Map<string, Map<string, VerbHit>>, spelling: string, inf: string, en: string): VerbHit {
  const byVerb = map.get(spelling) ?? new Map<string, VerbHit>();
  map.set(spelling, byVerb);
  const hit = byVerb.get(inf) ?? { inf, en, uses: [], nonfinite: [] };
  byVerb.set(inf, hit);
  return hit;
}

function addUse(hit: VerbHit, tense: TenseId, person: string) {
  let use = hit.uses.find((u) => u.tense === tense);
  if (!use) hit.uses.push((use = { tense, persons: [] }));
  if (!use.persons.includes(person)) use.persons.push(person);
}

function buildIndex(): Index {
  const index: Index = { words: new Map(), verbs: new Map(), attachable: new Map() };

  for (const n of NOUNS) {
    const base = { key: `noun:${n.es}`, headword: `${nounArticle(n)} ${n.es}`, en: n.en, item: `vocab:noun:${n.es}:toEnglish` };
    addWord(index, n.es, { ...base, detail: "Noun" });
    if (nounPlural(n) !== n.es) addWord(index, nounPlural(n), { ...base, detail: "Noun, plural" });
  }
  for (const a of ADJECTIVES) {
    adjectiveForms(a).forEach((form, i) => {
      addWord(index, form, {
        key: `adjective:${a.es}`,
        headword: a.es,
        en: a.en,
        detail: form === a.es ? "Adjective" : `Adjective, ${FORM_NAMES[i].toLowerCase()}`,
        item: `vocab:adjective:${a.es}:toEnglish`,
      });
    });
  }
  for (const a of ADVERBS) {
    addWord(index, a.es, { key: `adverb:${a.es}`, headword: a.es, en: a.en, detail: "Adverb", item: `vocab:adverb:${a.es}:toEnglish` });
  }
  for (const w of SMALL_WORDS) {
    const match = { key: `small:${w.es}:${w.en}`, headword: w.es, en: w.en, detail: "Small word", item: `vocab:small:${w.es}:toEnglish` };
    addWord(index, w.es, match);
    for (const form of (w.forms ?? "").split(",").map((f) => f.trim()).filter(Boolean)) addWord(index, form, match);
  }

  for (const verb of VERBS) {
    const c = conjugate(verb);
    const finite = (spelling: string, tense: TenseId, person: string) => {
      const bare = spelling.replace(REFLEXIVE, "");
      if (oneWord(bare)) addUse(verbHit(index.verbs, norm(bare), verb.inf, verb.en), tense, person);
    };
    for (const { id } of TENSES) {
      const forms = c.tenses[id];
      if (!forms) continue;
      forms.forms.forEach((form, person) => {
        const label = personLabel(id, person);
        if (form && label) finite(form, id, label);
      });
      if (forms.vos) finite(forms.vos, id, "vos");
      if (id === "impAffirmative") {
        for (const form of forms.forms) if (form) addUse(verbHit(index.attachable, stripAccents(norm(form)), verb.inf, verb.en), id, "");
      }
    }
    const base = verb.inf.replace(/se$/, "");
    const nonfinite: [string, string][] = [
      [base, "Infinitive"],
      [c.gerund, "Gerund (-ing form)"],
      [c.participle, "Past participle"],
      ...(c.participleAlt ? [[c.participleAlt, "Past participle"] as [string, string]] : []),
    ];
    for (const [form, name] of nonfinite) {
      if (!form || !oneWord(form)) continue;
      const hit = verbHit(index.verbs, norm(form), verb.inf, verb.en);
      if (!hit.nonfinite.includes(name)) hit.nonfinite.push(name);
      if (name !== "Past participle") verbHit(index.attachable, stripAccents(norm(form)), verb.inf, verb.en).nonfinite.push(name);
    }
  }
  return index;
}

let built: Index | null = null;

function verbMatch(hit: VerbHit): LookupMatch {
  const uses = hit.uses.map((u) => {
    const name = TENSES.find((t) => t.id === u.tense)!.name;
    const persons = u.persons.filter(Boolean);
    return persons.length ? `${name} · ${persons.join(", ")}` : name;
  });
  // The tense actually seen; an infinitive or gerund gets the present, the first tense anyone learns.
  const tense = hit.uses[0]?.tense ?? "present";
  return {
    key: `verb:${hit.inf}`,
    headword: hit.inf,
    en: hit.en,
    detail: [...hit.nonfinite, ...uses].join("; "),
    item: verbTrack(hit.inf, tense).item,
    href: `/verb/${verbSlug(hit.inf)}`,
  };
}

/** Every entry this spelling could belong to: "como" is both a small word and a form of comer. */
export function lookupWord(token: string): LookupMatch[] {
  built ??= buildIndex();
  const spelling = norm(token);
  const words = built.words.get(spelling) ?? [];
  const verbs = [...(built.verbs.get(spelling)?.values() ?? [])].map(verbMatch);
  if (words.length + verbs.length > 0) return [...words, ...verbs];

  // Pronouns attached to the end: dime, decirlo, diciéndome, levantarme.
  let base = spelling;
  for (let i = 0; i < 2 && CLITIC.test(base); i++) {
    base = base.replace(CLITIC, "");
    const hits = built.attachable.get(stripAccents(base));
    if (!hits) continue;
    return [...hits.values()].map((hit) => {
      const kinds = [...new Set(hit.nonfinite), ...(hit.uses.length ? ["Command"] : [])];
      return { ...verbMatch(hit), detail: `${kinds.join(" or ")}, with a pronoun attached` };
    });
  }
  return [];
}

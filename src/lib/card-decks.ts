import { conjugate } from "./conjugation/engine";
import { TENSES, type TenseId } from "./conjugation/types";
import { englishAnswers, personLabel, type Card } from "./drill";
import type { SentenceGroups } from "./sentence-data";
import { findForm, sentenceGroup, type Sentence } from "./sentences";
import { verbSlug, type Verb } from "./verbs";
import { ADJECTIVES, ADVERBS, NOUNS, adjectiveForms, isPluralOnly, nounArticle, type Adjective, type Noun } from "./vocab";

// Decks for the vocabulary and fill-in-the-blank drills. Imported on demand because it pulls in the word lists.

export type VocabKind = "toSpanish" | "toEnglish" | "gender" | "agreement";

type Random = () => number;
const pick = <T,>(list: T[], random: Random): T => list[Math.floor(random() * list.length)];

interface Word {
  es: string;
  en: string;
  accepted: string[];
  shown: string;
}

const nounWord = (n: Noun): Word => ({
  es: n.es,
  en: n.en,
  accepted: [n.es, `${nounArticle(n)} ${n.es}`],
  shown: `${nounArticle(n)} ${n.es}`,
});

const plainWord = (w: { es: string; en: string }): Word => ({ es: w.es, en: w.en, accepted: [w.es], shown: w.es });

const allWords = (): Word[] => [...NOUNS.map(nounWord), ...ADJECTIVES.map(plainWord), ...ADVERBS.map(plainWord)];

const genderNouns = () => NOUNS.filter((n) => !n.article && !isPluralOnly(n));

const FORM_NAMES = ["masculine singular", "feminine singular", "masculine plural", "feminine plural"];

/** Adjectives worth drilling: ones where the forms actually differ. */
const agreeingAdjectives = () => ADJECTIVES.filter((a) => new Set(adjectiveForms(a)).size > 1);

function toSpanishCard(words: Word[], random: Random): Card {
  const word = pick(words, random);
  // Words sharing a gloss are all correct: "house" can't tell the learner which one is meant.
  const sameMeaning = words.filter((w) => w.en === word.en);
  return {
    id: `es:${word.es}`,
    context: "English to Spanish",
    title: word.en,
    titleIsSpanish: false,
    ask: "In Spanish",
    answers: sameMeaning.flatMap((w) => w.accepted),
    shown: word.shown,
  };
}

function toEnglishCard(words: Word[], random: Random): Card {
  const word = pick(words, random);
  return {
    id: `en:${word.es}`,
    context: "Spanish to English",
    title: word.es,
    titleIsSpanish: true,
    ask: "In English",
    answers: englishAnswers(word.en),
    shown: word.en,
    english: true,
  };
}

function genderCard(nouns: Noun[], random: Random): Card {
  const noun = pick(nouns, random);
  return {
    id: `gender:${noun.es}`,
    context: "Noun gender",
    title: noun.es,
    titleIsSpanish: true,
    subtitle: noun.en,
    ask: "Which article?",
    answers: [nounArticle(noun)],
    shown: `${nounArticle(noun)} ${noun.es}`,
    choices: ["el", "la"],
  };
}

function agreementCard(adjectives: Adjective[], random: Random): Card {
  const adjective = pick(adjectives, random);
  const forms = adjectiveForms(adjective);
  const slot = Math.floor(random() * forms.length);
  return {
    id: `agree:${adjective.es}:${slot}`,
    context: "Adjective agreement",
    title: adjective.es,
    titleIsSpanish: true,
    subtitle: adjective.en,
    ask: `Form for ${FORM_NAMES[slot]}`,
    answers: [forms[slot]],
    shown: forms[slot],
  };
}

export function vocabDeck(kinds: VocabKind[], random: Random = Math.random): () => Card | null {
  const words = allWords();
  const nouns = genderNouns();
  const adjectives = agreeingAdjectives();
  return () => {
    if (kinds.length === 0) return null;
    const kind = pick(kinds, random);
    if (kind === "toSpanish") return toSpanishCard(words, random);
    if (kind === "toEnglish") return toEnglishCard(words, random);
    if (kind === "gender") return genderCard(nouns, random);
    return agreementCard(adjectives, random);
  };
}

const BLANK = "_____";

/** The example sentence with its verb removed, or null when the tense has no usable sentence. */
export function blankCard(groups: SentenceGroups, verb: Verb, tense: TenseId): Card | null {
  const entry = groups[sentenceGroup(verb.inf)]?.[verb.inf]?.[tense];
  if (!entry || "rare" in entry) return null;
  const sentence: Sentence = entry;
  const form = conjugate(verb).tenses[tense]?.forms[sentence.person];
  const hit = form ? findForm(sentence.es, form) : null;
  if (!hit) return null;
  const meta = TENSES.find((t) => t.id === tense)!;
  return {
    id: `blank:${verb.inf}:${tense}`,
    context: `${meta.name} · ${meta.hint}`,
    title: sentence.es.slice(0, hit.start) + BLANK + sentence.es.slice(hit.end),
    titleIsSpanish: true,
    subtitle: sentence.en,
    ask: `${verb.inf}, ${personLabel(tense, sentence.person)}`,
    answers: [sentence.es.slice(hit.start, hit.end)],
    shown: sentence.es.slice(hit.start, hit.end).toLowerCase(),
    link: { href: `/verb/${verbSlug(verb.inf)}`, label: `See all forms of ${verb.inf}` },
  };
}

export function blankDeck(
  groups: SentenceGroups,
  verbs: Verb[],
  tenses: TenseId[],
  random: Random = Math.random,
): () => Card | null {
  return () => {
    if (verbs.length === 0 || tenses.length === 0) return null;
    // Rare tenses have no sentence, so a random pick can miss.
    for (let i = 0; i < 40; i++) {
      const card = blankCard(groups, pick(verbs, random), pick(tenses, random));
      if (card) return card;
    }
    for (const verb of verbs) {
      for (const tense of tenses) {
        const card = blankCard(groups, verb, tense);
        if (card) return card;
      }
    }
    return null;
  };
}

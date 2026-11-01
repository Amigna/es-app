import { conjugate } from "./conjugation/engine";
import { TENSES, type TenseId } from "./conjugation/types";
import { englishAnswers, personLabel, verbTrack, type Card } from "./drill";
import type { VocabKind, WordType } from "./drill-settings";
import type { SentenceGroups } from "./sentence-data";
import { blankOut, findForm, findSentence } from "./sentences";
import { verbSlug, type Verb } from "./verbs";
import { ADJECTIVES, ADVERBS, NOUNS, adjectiveForms, isPluralOnly, nounArticle, type Adjective, type Noun } from "./vocab";

// Decks for the vocabulary and fill-in-the-blank drills. Imported on demand because it pulls in the word lists.

export interface VocabOptions {
  kinds: VocabKind[];
  wordTypes: WordType[];
  /** Noun topics to include; empty means all of them. */
  topics: string[];
}

type Random = () => number;
const pick = <T,>(list: T[], random: Random): T => list[Math.floor(random() * list.length)];

interface Word {
  es: string;
  en: string;
  type: WordType;
  accepted: string[];
  shown: string;
}

const nounWord = (n: Noun): Word => ({
  es: n.es,
  en: n.en,
  type: "noun",
  accepted: [n.es, `${nounArticle(n)} ${n.es}`],
  shown: `${nounArticle(n)} ${n.es}`,
});

const plainWord =
  (type: WordType) =>
  (w: { es: string; en: string }): Word => ({ es: w.es, en: w.en, type, accepted: [w.es], shown: w.es });

/** Includes the word type because some spellings are two words: mañana is both "morning" and "tomorrow". */
const vocabTrack = (type: WordType, es: string, kind: VocabKind) => ({ item: `vocab:${type}:${es}:${kind}` });

const FORM_NAMES = ["masculine singular", "feminine singular", "masculine plural", "feminine plural"];

/** Adjectives worth drilling: ones where the forms actually differ. */
const agreeingAdjectives = () => ADJECTIVES.filter((a) => new Set(adjectiveForms(a)).size > 1);

function toSpanishCard(words: Word[], everyWord: Word[], random: Random): Card {
  const word = pick(words, random);
  // Any word sharing a core meaning is correct: "bus" can't tell the learner whether autobús or guagua is meant.
  const meanings = englishAnswers(word.en);
  const sameMeaning = everyWord.filter((w) => englishAnswers(w.en).some((m) => meanings.includes(m)));
  return {
    id: `es:${word.es}`,
    badge: "English to Spanish",
    title: word.en,
    titleIsSpanish: false,
    ask: "In Spanish",
    answers: sameMeaning.flatMap((w) => w.accepted),
    shown: word.shown,
    track: vocabTrack(word.type, word.es, "toSpanish"),
  };
}

function toEnglishCard(words: Word[], random: Random): Card {
  const word = pick(words, random);
  return {
    id: `en:${word.es}`,
    badge: "Spanish to English",
    title: word.es,
    titleIsSpanish: true,
    ask: "In English",
    answers: englishAnswers(word.en),
    shown: word.en,
    english: true,
    track: vocabTrack(word.type, word.es, "toEnglish"),
  };
}

function genderCard(nouns: Noun[], random: Random): Card {
  const noun = pick(nouns, random);
  return {
    id: `gender:${noun.es}`,
    badge: "Noun gender",
    title: noun.es,
    titleIsSpanish: true,
    subtitle: noun.en,
    ask: "Which article?",
    answers: [nounArticle(noun)],
    shown: `${nounArticle(noun)} ${noun.es}`,
    choices: ["el", "la"],
    track: vocabTrack("noun", noun.es, "gender"),
  };
}

function agreementCard(adjectives: Adjective[], random: Random): Card {
  const adjective = pick(adjectives, random);
  const forms = adjectiveForms(adjective);
  const slot = Math.floor(random() * forms.length);
  return {
    id: `agree:${adjective.es}:${slot}`,
    badge: "Adjective agreement",
    title: adjective.es,
    titleIsSpanish: true,
    subtitle: adjective.en,
    ask: `Form for ${FORM_NAMES[slot]}`,
    answers: [forms[slot]],
    shown: forms[slot],
    track: vocabTrack("adjective", adjective.es, "agreement"),
  };
}

export function vocabDeck({ kinds, wordTypes, topics }: VocabOptions, random: Random = Math.random): () => Card | null {
  const has = (type: WordType) => wordTypes.includes(type);
  const nouns = has("noun") ? NOUNS.filter((n) => topics.length === 0 || topics.includes(n.topic)) : [];
  const adjectives = has("adjective") ? ADJECTIVES : [];
  const adverbs = has("adverb") ? ADVERBS : [];

  const words = [...nouns.map(nounWord), ...adjectives.map(plainWord("adjective")), ...adverbs.map(plainWord("adverb"))];
  const everyWord = [...NOUNS.map(nounWord), ...ADJECTIVES.map(plainWord("adjective")), ...ADVERBS.map(plainWord("adverb"))];
  const genderNouns = nouns.filter((n) => !n.article && !isPluralOnly(n));
  const agreeing = has("adjective") ? agreeingAdjectives() : [];

  // Drop question types with nothing to ask, e.g. noun gender with only adverbs selected.
  const usable = kinds.filter((k) => {
    if (k === "gender") return genderNouns.length > 0;
    if (k === "agreement") return agreeing.length > 0;
    return words.length > 0;
  });

  return () => {
    if (usable.length === 0) return null;
    const kind = pick(usable, random);
    if (kind === "toSpanish") return toSpanishCard(words, everyWord, random);
    if (kind === "toEnglish") return toEnglishCard(words, random);
    if (kind === "gender") return genderCard(genderNouns, random);
    return agreementCard(agreeing, random);
  };
}

/** The example sentence with its verb removed, or null when the tense has no usable sentence. */
export function blankCard(groups: SentenceGroups, verb: Verb, tense: TenseId): Card | null {
  const sentence = findSentence(groups, verb.inf, tense);
  if (!sentence) return null;
  const form = conjugate(verb).tenses[tense]?.forms[sentence.person];
  const hit = form ? findForm(sentence.es, form) : null;
  if (!hit) return null;
  const meta = TENSES.find((t) => t.id === tense)!;
  return {
    id: `blank:${verb.inf}:${tense}`,
    badge: meta.name,
    context: meta.hint,
    title: blankOut(sentence.es, form!),
    titleIsSpanish: true,
    subtitle: sentence.en,
    ask: `${verb.inf}, ${personLabel(tense, sentence.person)}`,
    answers: [sentence.es.slice(hit.start, hit.end)],
    shown: sentence.es.slice(hit.start, hit.end).toLowerCase(),
    link: { href: `/verb/${verbSlug(verb.inf)}`, label: `See all forms of ${verb.inf}` },
    track: verbTrack(verb.inf, tense),
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

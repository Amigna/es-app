import { alsoAccepted, conjugate } from "./conjugation/engine";
import { TENSES, type TenseId } from "./conjugation/types";
import { COMMON_COUNT, CORE_TENSES, conjugationCard, englishAnswers, makeQuestion, personLabel, rareKey, tenseTable, verbForms, verbTrack, type Card } from "./drill";
import type { CardType, FlashSide, StudySide, VocabKind, WordType } from "./drill-settings";
import { shuffled } from "./quiz";
import { blankOut, findForm, sentencesFor, type SentenceBank } from "./sentences";
import { VERBS, findVerb, type Verb } from "./verbs";
import { ADJECTIVES, ADVERBS, NOUNS, PHRASES, SMALL_WORDS, adjectiveForms, isPluralOnly, nounArticle, type Adjective, type Example, type Noun } from "./vocab";

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
  type: CardType;
  accepted: string[];
  shown: string;
  ex?: Example;
  note?: string;
}

const nounWord = (n: Noun): Word => ({
  es: n.es,
  en: n.en,
  type: "noun",
  accepted: [n.es, `${nounArticle(n)} ${n.es}`],
  shown: `${nounArticle(n)} ${n.es}`,
  ex: n.ex,
  note: n.note,
});

const plainWord =
  (type: CardType) =>
  (w: { es: string; en: string; ex?: Example; note?: string }): Word => ({ es: w.es, en: w.en, type, accepted: [w.es], shown: w.es, ex: w.ex, note: w.note });

/** Includes the word type because some spellings are two words: mañana is both "morning" and "tomorrow". */
const vocabTrack = (type: CardType, es: string, kind: VocabKind) => ({ item: `vocab:${type}:${es}:${kind}` });

const allWords = () => [
  ...NOUNS.map(nounWord),
  ...ADJECTIVES.map(plainWord("adjective")),
  ...ADVERBS.map(plainWord("adverb")),
  ...SMALL_WORDS.map(plainWord("small")),
];

const FORM_NAMES = ["masculine singular", "feminine singular", "masculine plural", "feminine plural"];

/** Adjectives worth drilling: ones where the forms actually differ. */
const agreeingAdjectives = () => ADJECTIVES.filter((a) => new Set(adjectiveForms(a)).size > 1);

function toSpanishCard(word: Word, everyWord: Word[]): Card {
  // Any word sharing a core meaning is correct: "bus" can't tell the learner whether autobús or guagua is meant.
  // Small words are the exception: "you (formal)" can't take tú, and the gloss is what tells them apart.
  const meanings = englishAnswers(word.en);
  const sameMeaning = everyWord.filter((w) =>
    word.type === "small" ? w.type === "small" && w.en === word.en : englishAnswers(w.en).some((m) => meanings.includes(m)),
  );
  return {
    id: `es:${word.es}`,
    badge: "English to Spanish",
    title: word.en,
    titleIsSpanish: false,
    ask: "In Spanish",
    answers: sameMeaning.flatMap((w) => w.accepted),
    shown: word.shown,
    track: vocabTrack(word.type, word.es, "toSpanish"),
    lookalikes: allSpellings(),
  };
}

let spellings: string[] | null = null;

/** Every word in the lists, built once and shared by every card: papa is a word, so it isn't a slip for papá. */
function allSpellings(): string[] {
  spellings ??= [
    ...NOUNS.map((n) => n.es),
    ...ADJECTIVES.flatMap(adjectiveForms),
    ...ADVERBS.map((a) => a.es),
    ...SMALL_WORDS.flatMap((w) => [w.es, ...(w.forms ?? "").split(",").map((f) => f.trim())]),
  ].filter(Boolean);
  return spellings;
}

function toEnglishCard(word: Word): Card {
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

function genderCard(noun: Noun): Card {
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

function agreementCard(adjective: Adjective, random: Random): Card {
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
  const smallWords = has("small") ? SMALL_WORDS : [];

  const words = [
    ...nouns.map(nounWord),
    ...adjectives.map(plainWord("adjective")),
    ...adverbs.map(plainWord("adverb")),
    ...smallWords.map(plainWord("small")),
  ];
  const everyWord = allWords();
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
    if (kind === "toSpanish") return toSpanishCard(pick(words, random), everyWord);
    if (kind === "toEnglish") return toEnglishCard(pick(words, random));
    if (kind === "gender") return genderCard(pick(genderNouns, random));
    return agreementCard(pick(agreeing, random), random);
  };
}

/** Shares its item with the typed question, so either one moves the same schedule. */
function flashcard(word: Word, side: FlashSide): Card {
  const toEnglish = side === "toEnglish";
  const shown = toEnglish ? word.en : word.shown;
  return {
    id: `flash:${side}:${word.type}:${word.es}`,
    badge: "Flashcard",
    title: toEnglish ? word.shown : word.en,
    titleIsSpanish: toEnglish,
    ask: toEnglish ? "What does it mean?" : "How do you say it in Spanish?",
    answers: [shown],
    shown,
    english: toEnglish,
    flashcard: { example: word.ex, note: word.note },
    track: vocabTrack(word.type, word.es, side),
  };
}

export interface FlashcardOptions {
  side: FlashSide;
  types: CardType[];
  /** Noun topics to include; empty means all of them. */
  topics: string[];
}

function chosenWords(types: CardType[], topics: string[]): Word[] {
  const has = (type: CardType) => types.includes(type);
  return [
    ...(has("noun") ? NOUNS.filter((n) => topics.length === 0 || topics.includes(n.topic)).map(nounWord) : []),
    ...(has("adjective") ? ADJECTIVES.map(plainWord("adjective")) : []),
    ...(has("adverb") ? ADVERBS.map(plainWord("adverb")) : []),
    ...(has("small") ? SMALL_WORDS.map(plainWord("small")) : []),
    ...(has("phrase") ? PHRASES.map(plainWord("phrase")) : []),
  ];
}

/** Each chosen word once, in random order. The deck runs out, which ends the session. */
export function flashcardDeck({ side, types, topics }: FlashcardOptions, random: Random = Math.random): () => Card | null {
  const order = shuffled(chosenWords(types, topics), random);
  let next = 0;
  return () => (next < order.length ? flashcard(order[next++], side) : null);
}

const TYPE_NAMES: Record<CardType, string> = { noun: "Noun", adjective: "Adjective", adverb: "Adverb", small: "Small word", phrase: "Phrase" };

/** A card to flip with nothing graded or saved. Either side can come first. */
export interface StudyCard {
  id: string;
  type: string;
  front: { text: string; spanish: boolean };
  back: { text: string; spanish: boolean };
  example?: Example;
  note?: string;
}

export interface StudyOptions {
  side: StudySide;
  types: CardType[];
  /** Noun topics to include; empty means all of them. */
  topics: string[];
}

/** Every chosen word in random order. The learner pages through them, so the whole list is handed over. */
export function studyCards({ side, types, topics }: StudyOptions, random: Random = Math.random): StudyCard[] {
  return shuffled(chosenWords(types, topics), random).map((word) => {
    const spanish = { text: word.shown, spanish: true };
    const english = { text: word.en, spanish: false };
    const spanishFirst = side === "mixed" ? random() < 0.5 : side === "toEnglish";
    return {
      id: `study:${word.type}:${word.es}`,
      type: TYPE_NAMES[word.type],
      front: spanishFirst ? spanish : english,
      back: spanishFirst ? english : spanish,
      example: word.ex,
      note: word.note,
    };
  });
}

/** The example sentence with its verb removed, or null when the tense has no usable sentence. */
export function blankCard(bank: SentenceBank, verb: Verb, tense: TenseId, random: Random = Math.random): Card | null {
  const sentences = sentencesFor(bank, verb.inf, tense);
  if (sentences.length === 0) return null;
  const sentence = pick(sentences, random);
  const conjugation = conjugate(verb);
  const form = conjugation.tenses[tense]?.forms[sentence.person];
  const hit = form ? findForm(sentence.es, form) : null;
  if (!hit) return null;
  const meta = TENSES.find((t) => t.id === tense)!;
  const answer = sentence.es.slice(hit.start, hit.end);
  return {
    id: `blank:${verb.inf}:${tense}:${sentence.person}`,
    badge: meta.name,
    context: meta.hint,
    title: blankOut(sentence.es, form!),
    titleIsSpanish: true,
    subtitle: sentence.en,
    sentence: sentence.es,
    ask: `${verb.inf}, ${personLabel(tense, sentence.person)}`,
    answers: [answer, ...alsoAccepted(conjugation, answer)],
    shown: answer.toLowerCase(),
    table: tenseTable(verb, tense, sentence.person, sentences, sentence),
    track: verbTrack(verb.inf, tense),
    lookalikes: verbForms(verb),
  };
}

/** Cards built from a verb and tense, which can come back null for a tense with no sentence. */
function sentenceDeck(verbs: Verb[], tenses: TenseId[], build: (verb: Verb, tense: TenseId) => Card | null, random: Random): () => Card | null {
  return () => {
    if (verbs.length === 0 || tenses.length === 0) return null;
    // Rare tenses have no sentence, so a random pick can miss.
    for (let i = 0; i < 40; i++) {
      const card = build(pick(verbs, random), pick(tenses, random));
      if (card) return card;
    }
    for (const verb of verbs) {
      for (const tense of tenses) {
        const card = build(verb, tense);
        if (card) return card;
      }
    }
    return null;
  };
}

export function blankDeck(bank: SentenceBank, verbs: Verb[], tenses: TenseId[], random: Random = Math.random): () => Card | null {
  return sentenceDeck(verbs, tenses, (verb, tense) => blankCard(bank, verb, tense, random), random);
}

/** One saved item per direction: translations aren't scheduled, so there's nothing to keep per sentence. */
export function writingCard(bank: SentenceBank, verb: Verb, tense: TenseId, side: FlashSide, random: Random = Math.random): Card | null {
  const sentences = sentencesFor(bank, verb.inf, tense);
  if (sentences.length === 0) return null;
  const sentence = pick(sentences, random);
  const toEnglish = side === "toEnglish";
  const shown = toEnglish ? sentence.en : sentence.es;
  return {
    id: `write:${side}:${verb.inf}:${tense}:${sentence.person}`,
    badge: toEnglish ? "Spanish to English" : "English to Spanish",
    context: TENSES.find((t) => t.id === tense)!.name,
    title: toEnglish ? sentence.es : sentence.en,
    titleIsSpanish: toEnglish,
    ask: toEnglish ? "Write it in English" : "Write it in Spanish",
    answers: [shown],
    shown,
    english: toEnglish,
    writing: true,
    track: { item: `writing:${side}` },
    ...(toEnglish ? {} : { lookalikes: verbForms(verb) }),
  };
}

export function writingDeck(bank: SentenceBank, verbs: Verb[], tenses: TenseId[], sides: FlashSide[], random: Random = Math.random): () => Card | null {
  if (sides.length === 0) return () => null;
  return sentenceDeck(verbs, tenses, (verb, tense) => writingCard(bank, verb, tense, pick(sides, random), random), random);
}

/** A spoken number can be typed as a word or as digits, so those sentences are left out. */
const dictationSentences = (bank: SentenceBank, inf: string, tense: TenseId) => sentencesFor(bank, inf, tense).filter((s) => !/\d/.test(s.es));

/** One saved item for all of dictation: like writing, the sentences aren't scheduled. */
export function dictationCard(bank: SentenceBank, verb: Verb, tense: TenseId, random: Random = Math.random): Card | null {
  const sentences = dictationSentences(bank, verb.inf, tense);
  if (sentences.length === 0) return null;
  const sentence = pick(sentences, random);
  return {
    id: `listen:${verb.inf}:${tense}:${sentence.person}`,
    badge: "Dictation",
    context: TENSES.find((t) => t.id === tense)!.name,
    title: "Listen, then type what you hear",
    titleIsSpanish: false,
    ask: "In Spanish, as you heard it",
    answers: [sentence.es],
    shown: sentence.es,
    dictation: { en: sentence.en },
    track: { item: "listening:dictation" },
    lookalikes: verbForms(verb),
  };
}

export function dictationDeck(bank: SentenceBank, verbs: Verb[], tenses: TenseId[], random: Random = Math.random): () => Card | null {
  return sentenceDeck(verbs, tenses, (verb, tense) => dictationCard(bank, verb, tense, random), random);
}

function vocabReviewCard(type: string, es: string, kind: string, random: Random): Card | null {
  if (type === "phrase") {
    const phrase = PHRASES.find((p) => p.es === es);
    return phrase ? flashcard(plainWord("phrase")(phrase), kind === "toSpanish" ? "toSpanish" : "toEnglish") : null;
  }
  const noun = type === "noun" ? NOUNS.find((n) => n.es === es) : undefined;
  const adjective = type === "adjective" ? ADJECTIVES.find((a) => a.es === es) : undefined;
  if (kind === "gender") return noun ? genderCard(noun) : null;
  if (kind === "agreement") return adjective ? agreementCard(adjective, random) : null;
  const everyWord = allWords();
  const word = everyWord.find((w) => w.type === type && w.es === es);
  if (!word) return null;
  return kind === "toSpanish" ? toSpanishCard(word, everyWord) : toEnglishCard(word);
}

/** Rebuilds a card from a saved item ID, or null when its verb or word is no longer in the data. */
export function reviewCard(item: string, bank: SentenceBank, rare: Set<string>, random: Random = Math.random): Card | null {
  const [source, ...parts] = item.split(":");
  if (source === "vocab") return vocabReviewCard(parts[0], parts[1], parts[2], random);
  if (source !== "verb") return null;
  const [inf, tense] = parts as [string, TenseId];
  const verb = findVerb(inf);
  if (verb?.inf !== inf) return null;
  const question = makeQuestion([verb], [tense], rare, random);
  if (!question) return null;
  // Either kind of question works the same item, so mix them.
  const blank = random() < 0.5 ? blankCard(bank, verb, tense, random) : null;
  return blank ?? conjugationCard(question, sentencesFor(bank, inf, tense));
}

/** Skips anything that can't be rebuilt, so one removed word doesn't end the session. */
export function reviewDeck(items: string[], bank: SentenceBank, rare: Set<string>, random: Random = Math.random): () => Card | null {
  let next = 0;
  return () => {
    while (next < items.length) {
      const card = reviewCard(items[next++], bank, rare, random);
      if (card) return card;
    }
    return null;
  };
}

/** Haber has no commands, for example, and that isn't marked rare because there's nothing to mark. */
const drillable = (verb: Verb, tense: TenseId, rare: Set<string>) =>
  !rare.has(rareKey(verb.inf, tense)) && !!conjugate(verb).tenses[tense]?.forms.some(Boolean);

function verbItems(rare: Set<string>): string[] {
  const otherTenses = TENSES.map((t) => t.id).filter((t) => !CORE_TENSES.includes(t));
  const common = VERBS.slice(0, COMMON_COUNT);
  const rest = VERBS.slice(COMMON_COUNT);
  const stages: [Verb[], TenseId[]][] = [
    [common, CORE_TENSES],
    [rest, CORE_TENSES],
    [VERBS, otherTenses],
  ];
  return stages.flatMap(([verbs, tenses]) =>
    tenses.flatMap((tense) => verbs.filter((v) => drillable(v, tense, rare)).map((v) => verbTrack(v.inf, tense).item)),
  );
}

function wordItems(): string[] {
  const lists: [WordType, { es: string }[]][] = [
    ["noun", NOUNS],
    ["adjective", ADJECTIVES],
    ["adverb", ADVERBS],
    ["small", SMALL_WORDS],
  ];
  const meanings = (kind: VocabKind) => {
    const longest = Math.max(...lists.map(([, list]) => list.length));
    return Array.from({ length: longest }, (_, i) =>
      lists.flatMap(([type, list]) => (list[i] ? [vocabTrack(type, list[i].es, kind).item] : [])),
    ).flat();
  };
  const gender = NOUNS.filter((n) => !n.article && !isPluralOnly(n)).map((n) => vocabTrack("noun", n.es, "gender").item);
  const agreement = agreeingAdjectives().map((a) => vocabTrack("adjective", a.es, "agreement").item);
  return [...meanings("toEnglish"), ...meanings("toSpanish"), ...gender, ...agreement];
}

/** The order new items are introduced: common verbs in the everyday tenses, taking turns with words. */
export function newItemOrder(rare: Set<string>): string[] {
  const verbs = verbItems(rare);
  const words = wordItems();
  const order: string[] = [];
  for (let i = 0; i < Math.max(verbs.length, words.length); i++) {
    if (verbs[i]) order.push(verbs[i]);
    if (words[i]) order.push(words[i]);
  }
  return order;
}

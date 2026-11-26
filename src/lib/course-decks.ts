import { blankCard, blankDeck, listedWordCard, writingCard, writingDeck } from "./card-decks";
import { CHECKPOINT_MIX, CHECKPOINT_SIZE, EXAM_SIZE, REVIEW_RECENT_SHARE, REVIEW_SIZE, chapterSteps, type Chapter, type ChapterDrill } from "./course";
import { conjugate } from "./conjugation/engine";
import { TENSES } from "./conjugation/types";
import { conjugationCard, makeQuestion, personLabel, type Card } from "./drill";
import { NUMBER_KINDS } from "./drill-settings";
import { numberDeck } from "./number-cards";
import { QUIZ_RUN, freshestFirst, quizCard, shuffled, type QuizQuestion, type QuizSeen } from "./quiz";
import { blankOut, findForm, sentencesFor, sentencesUpTo, type Sentence, type SentenceBank } from "./sentences";
import type { Verb } from "./verbs";

// The drills inside a chapter, locked to its tenses, verbs, words and guide. Imported on demand like card-decks, which
// it pulls in. Answers count toward progress and the review schedule like any drill.

export { otherWay } from "./card-decks";

type Random = () => number;

export const PRACTICE_SIZE = 15;
export const WRITE_SIZE = 6;

/** The guide's questions for a chapter, each with its place in the full quiz, so saved items match the guide's own quiz. */
export interface ChapterQuiz {
  slug: string;
  title: string;
  questions: { index: number; question: QuizQuestion }[];
}

export interface ChapterData {
  chapter: Chapter;
  verbs: Verb[];
  bank: SentenceBank;
  rare: Set<string>;
  quiz: ChapterQuiz | null;
  /** Quiz questions this browser asked lately, which checkpoints ask last. */
  seen?: QuizSeen;
}

// About a third of each chapter's sentences are kept for its checkpoint, so the checkpoint never asks a sentence that
// Practice or Write just showed. Which third depends on the chapter, so a sentence held back in one chapter can be
// practiced in another.

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Whether a sentence is kept for the chapter's checkpoint and left out of its practice and writing. */
export const heldForCheckpoint = (chapterId: string, es: string) => hash(`${chapterId}|${es}`) % 3 === 0;

/** The chapter's sentences for one part: the checkpoint's held-back third, or the rest for practice and writing. */
function bankFor(data: ChapterData, part: "practice" | "checkpoint"): SentenceBank {
  const { chapter, bank } = data;
  const keep = (s: Sentence) => heldForCheckpoint(chapter.id, s.es) === (part === "checkpoint") && (!chapter.persons || chapter.persons.includes(s.person));
  return Object.fromEntries(
    Object.entries(bank).map(([inf, tenses]) => [
      inf,
      Object.fromEntries(Object.entries(tenses).map(([tense, entry]) => [tense, Array.isArray(entry) ? entry.filter(keep) : entry])),
    ]),
  );
}

const withBank = (data: ChapterData, part: "practice" | "checkpoint"): ChapterData => ({ ...data, bank: bankFor(data, part) });

/** A chapter word the question fits, like a noun for gender. Null when none does. */
function wordQuestion(words: string[], kind: "gender" | "agreement", random: Random): () => Card | null {
  const fitting = words.filter((id) => listedWordCard(id, kind));
  return () => (fitting.length ? listedWordCard(fitting[Math.floor(random() * fitting.length)], kind, random) : null);
}

/** Verbs whose meaning changes with the tense, as the preterite vs. imperfect guide teaches, said after a tense choice. */
export const TENSE_MEANINGS: Record<string, string> = {
  "verb:conocer:preterite": "Conocer in the preterite means met.",
  "verb:conocer:imperfect": "Conocer in the imperfect means knew, as in being familiar with someone or somewhere.",
  "verb:saber:preterite": "Saber in the preterite means found out.",
  "verb:saber:imperfect": "Saber in the imperfect means knew, or knew how to.",
  "verb:poder:preterite": "Poder in the preterite means managed to, and with no it means failed to.",
  "verb:poder:imperfect": "Poder in the imperfect means was able to, in general.",
  "verb:querer:preterite": "Querer in the preterite means tried to, and with no it means refused.",
  "verb:querer:imperfect": "Querer in the imperfect means wanted to, or loved with a person.",
};

/**
 * Fill in the blank with the tense hidden, so the sentence has to show which of the chapter's tenses it takes. After
 * answering, it says which one. The saved item is still the verb and tense, so stats by tense stay right.
 */
function chooseTenseDeck({ chapter, verbs, bank }: ChapterData, random: Random): () => Card | null {
  const blanks = blankDeck(bank, verbs, chapter.tenses, random);
  const names = chapter.tenses.map((t) => TENSES.find((m) => m.id === t)!.name);
  const label = `${names.slice(0, -1).join(", ")} or ${names.at(-1)!.toLowerCase()}?`;
  return () => {
    const card = blanks();
    const tense = card && TENSES.find((t) => t.id === card.track?.tense);
    if (!card || !tense) return card;
    const meaning = TENSE_MEANINGS[card.track!.item];
    const explain = `This sentence takes the ${tense.name.toLowerCase()}.${meaning ? ` ${meaning}` : ""}`;
    return { ...card, id: `choose:${card.id}`, badge: label, context: "Which tense does the sentence need?", explain };
  };
}

/**
 * Fill in the blank with the verb hidden, so the sentence has to show which of the chapter's verbs it takes, like ser
 * or estar. Only the person is given. After answering, it says which verb.
 */
function chooseVerbDeck({ chapter, verbs, bank }: ChapterData, random: Random): () => Card | null {
  const blanks = blankDeck(bank, verbs, chapter.tenses, random);
  const label = `${verbs.slice(0, -1).map((v) => v.inf).join(", ")} or ${verbs.at(-1)!.inf}?`;
  return () => {
    const card = blanks();
    const inf = card?.track?.item?.split(":")[1];
    if (!card || !inf) return card;
    const person = card.ask.slice(card.ask.indexOf(", ") + 2);
    return {
      ...card,
      id: `chooseVerb:${card.id}`,
      badge: label.charAt(0).toUpperCase() + label.slice(1),
      context: "Which verb does the sentence need?",
      ask: person,
      explain: `This sentence takes ${inf}.`,
    };
  };
}

// The present progressive isn't a tense of its own in the engine: it's estar's present plus the gerund. Its sentences
// are kept under the verb's present, and only the ones with the progressive form count.

const ESTAR = ["estoy", "estás", "está", "estamos", "están"];
const PROGRESSIVE = "Present progressive";
const PROGRESSIVE_HINT = "estar + -ando or -iendo";
/** One tally for the whole chapter, like numbers: it isn't a tense, so it's not scheduled by verb. */
const PROGRESSIVE_TRACK = { item: "progressive:present" };

export const progressiveForm = (verb: Verb, person: number) => `${ESTAR[person]} ${conjugate(verb).gerund}`;

/** A verb's sentences with the progressive form in them, from the chapter's own sentences. */
export const progressiveSentences = (bank: SentenceBank, verb: Verb) =>
  sentencesFor(bank, verb.inf, "present").filter((s) => findForm(s.es, progressiveForm(verb, s.person)));

const pick = <T,>(list: T[], random: Random) => list[Math.floor(random() * list.length)];

function progressiveExplain(verb: Verb, person: number): string {
  const gerund = conjugate(verb).gerund;
  return `${ESTAR[person].charAt(0).toUpperCase() + ESTAR[person].slice(1)} plus the gerund ${gerund}.`;
}

/** Verb forms (comer, nosotros: estamos comiendo) and fill in the blank in the chapter's sentences, in turn. */
function progressiveDeck({ chapter, verbs, bank }: ChapterData, random: Random): () => Card | null {
  const persons = chapter.persons ?? [0, 1, 2, 3, 4];
  let turn = 0;
  const form = (): Card | null => {
    const verb = pick(verbs, random);
    const person = pick(persons, random);
    const answer = progressiveForm(verb, person);
    const sentence = progressiveSentences(bank, verb).find((s) => s.person === person);
    return {
      id: `progressive:${verb.inf}:${person}`,
      badge: PROGRESSIVE,
      context: PROGRESSIVE_HINT,
      person: personLabel("present", person),
      title: verb.inf,
      titleIsSpanish: true,
      subtitle: verb.en,
      ...(sentence ? { example: { es: blankOut(sentence.es, answer), en: sentence.en }, sentence: sentence.es } : {}),
      ask: `${PROGRESSIVE} · ${personLabel("present", person)}`,
      answers: [answer],
      shown: answer,
      explain: progressiveExplain(verb, person),
      track: PROGRESSIVE_TRACK,
    };
  };
  const blank = (): Card | null => {
    const options = verbs.filter((verb) => progressiveSentences(bank, verb).length > 0);
    return options.length ? progressiveBlank(bank, pick(options, random), random) : null;
  };
  return () => (verbs.length === 0 ? null : turn++ % 2 === 0 ? form() : (blank() ?? form()));
}

/** One of the verb's progressive sentences with estar and the gerund blanked. Null when it has none. */
function progressiveBlank(bank: SentenceBank, verb: Verb, random: Random): Card | null {
  const sentences = progressiveSentences(bank, verb);
  if (sentences.length === 0) return null;
  const s = pick(sentences, random);
  const wanted = progressiveForm(verb, s.person);
  const hit = findForm(s.es, wanted)!;
  const answer = s.es.slice(hit.start, hit.end);
  return {
    id: `progressive:blank:${verb.inf}:${s.person}`,
    badge: PROGRESSIVE,
    context: PROGRESSIVE_HINT,
    person: personLabel("present", s.person),
    title: blankOut(s.es, wanted),
    titleIsSpanish: true,
    subtitle: s.en,
    sentence: s.es,
    ask: `${verb.inf}, ${personLabel("present", s.person)}`,
    answers: [answer],
    shown: answer.toLowerCase(),
    explain: progressiveExplain(verb, s.person),
    track: PROGRESSIVE_TRACK,
  };
}

/** Translations of the chapter's progressive sentences, both ways, labeled as the progressive. */
function progressiveWritingDeck({ verbs, bank }: ChapterData, random: Random): () => Card | null {
  return () => {
    const options = verbs.filter((verb) => progressiveSentences(bank, verb).length > 0);
    if (options.length === 0) return null;
    const verb = pick(options, random);
    const only: SentenceBank = { [verb.inf]: { present: progressiveSentences(bank, verb) } };
    const card = writingCard(only, verb, "present", random() < 0.5 ? "toEnglish" : "toSpanish", random);
    return card && { ...card, id: card.id.replace(":present:", ":progressive:"), context: PROGRESSIVE };
  };
}

/** Conjugation, with only the chapter's persons when it names some. */
function conjugationDeck({ chapter, verbs, bank, rare }: ChapterData, random: Random): () => Card | null {
  return () => {
    for (let i = 0; i < 40; i++) {
      const q = makeQuestion(verbs, chapter.tenses, rare, random);
      if (!q) return null;
      if (!chapter.persons || chapter.persons.includes(q.person)) return conjugationCard(q, sentencesFor(bank, q.verb.inf, q.tense));
    }
    return null;
  };
}

/** The chapter's drills in turn: verb forms, or gender and agreement on its words. Endless, so callers limit it. */
function drillDeck(data: ChapterData, random: Random): () => Card | null {
  const { chapter, verbs, bank } = data;
  const decks: Record<ChapterDrill, () => () => Card | null> = {
    blanks: () => blankDeck(bank, verbs, chapter.tenses, random),
    conjugation: () => conjugationDeck(data, random),
    gender: () => wordQuestion(chapter.words, "gender", random),
    agreement: () => wordQuestion(chapter.words, "agreement", random),
    choose: () => chooseTenseDeck(data, random),
    chooseVerb: () => chooseVerbDeck(data, random),
    // Up to 1,000, as the A1 lesson covers, with every kind of question.
    numbers: () => numberDeck({ kinds: NUMBER_KINDS, max: 1000 }, random),
    progressive: () => progressiveDeck(data, random),
  };
  const kinds = chapter.drills.map((d) => decks[d]());
  let turn = Math.floor(random() * Math.max(1, kinds.length));
  return () => {
    if (kinds.length === 0) return null;
    // A verb with no sentence for the tense gives no blank, so another kind fills in.
    for (let i = 0; i < kinds.length; i++) {
      const card = kinds[turn++ % kinds.length]();
      if (card) return card;
    }
    return null;
  };
}

/** The Spanish sentence a card is built on, if any, so one checkpoint doesn't ask the same sentence two ways. */
function spanishOf(card: Card): string | undefined {
  if (card.sentence) return card.sentence;
  if (card.writing) return card.titleIsSpanish ? card.title : card.shown;
  return undefined;
}

const cardKey = (card: Card) => `${card.id}|${card.title}`;

/**
 * Up to `count` different cards, so a step never asks the same thing twice. A small chapter gives fewer cards rather
 * than repeats. The prompt counts too, since a verb's sentences for one person share an ID. Cards on a sentence already
 * in `sentences` are skipped, and the ones taken are added to it.
 */
function distinct(next: () => Card | null, count: number, sentences?: Set<string>): Card[] {
  const out = new Map<string, Card>();
  for (let tries = 0; out.size < count && tries < count * 8; tries++) {
    const card = next();
    if (!card) break;
    const es = spanishOf(card);
    if (out.has(cardKey(card)) || (sentences && es && sentences.has(es))) continue;
    out.set(cardKey(card), card);
    if (sentences && es) sentences.add(es);
  }
  return [...out.values()];
}

const queue = (cards: Card[]): (() => Card | null) => {
  const left = [...cards];
  return () => left.shift() ?? null;
};

// Drills a chapter's new verbs can have to themselves. Choosing the verb needs every verb the chapter compares, and the
// others aren't about verbs.
const NEW_VERB_DRILLS: ChapterDrill[] = ["blanks", "conjugation", "choose", "progressive"];

/** The share of Practice asked on the chapter's new verbs alone, on top of their turns among all its verbs. */
export const NEW_VERB_SHARE = 0.5;

/** The chapter's drills, about half of them on its new verbs, so the verbs just introduced get the most practice. */
function practiceDrills(data: ChapterData, random: Random): () => Card | null {
  const all = drillDeck(data, random);
  const newVerbs = data.verbs.filter((v) => data.chapter.newVerbs?.includes(v.inf));
  const drills = data.chapter.drills.filter((d) => NEW_VERB_DRILLS.includes(d));
  if (newVerbs.length === 0 || drills.length === 0) return all;
  const fresh = drillDeck({ ...data, verbs: newVerbs, chapter: { ...data.chapter, drills } }, random);
  return () => (random() < NEW_VERB_SHARE ? (fresh() ?? all()) : all());
}

export function practiceDeck(data: ChapterData, random: Random = Math.random): () => Card | null {
  return queue(distinct(practiceDrills(withBank(data, "practice"), random), PRACTICE_SIZE));
}

export function quizCards(quiz: ChapterQuiz, random: Random = Math.random): Card[] {
  return quiz.questions.map(({ index, question }) => quizCard(quiz.slug, index, quiz.title, question, random));
}

/** A dozen of the chapter's questions, the ones not asked lately first, so a retake isn't a memory test. */
export function chapterQuizDeck(quiz: ChapterQuiz, seen: QuizSeen = {}, random: Random = Math.random): () => Card | null {
  return queue(shuffled(freshestFirst(quizCards(quiz, random), seen, random).slice(0, QUIZ_RUN), random));
}

/**
 * A new verb's meaning to flip and grade yourself, with one of its sentences in the chapter's tense shown with the
 * answer. Not saved: verbs are scheduled by tense, and the fill-in-the-blank card that follows is.
 */
function verbMeaningCard(data: ChapterData, verb: Verb, random: Random): Card {
  const { chapter, bank } = data;
  const sentences = chapter.drills.includes("progressive")
    ? progressiveSentences(bank, verb)
    : chapter.tenses.flatMap((tense) => sentencesFor(bank, verb.inf, tense));
  const example = sentences.length ? pick(sentences, random) : undefined;
  const tables = chapter.drills.includes("progressive") ? [] : chapter.tenses.filter((tense) => conjugate(verb).tenses[tense]).map((tense) => ({ verb, tense }));
  return {
    id: `newverb:${verb.inf}`,
    badge: "New verb",
    title: verb.inf,
    titleIsSpanish: true,
    ask: "What does it mean?",
    answers: [verb.en],
    shown: verb.en,
    english: true,
    flashcard: {
      ...(example ? { example: { es: example.es, en: example.en } } : {}),
      // The forms come before the fill-in questions, so an irregular like conozco isn't a first guess. The progressive
      // isn't a tense of its own, so it has no table.
      ...(tables.length ? { tables } : {}),
    },
  };
}

/** The new verb in one of its sentences, in the chapter's tense and persons, or as a verb form when it has none. */
function newVerbBlank(data: ChapterData, verb: Verb, random: Random): Card | null {
  const { chapter, bank, rare } = data;
  if (chapter.drills.includes("progressive")) return progressiveBlank(bank, verb, random) ?? progressiveDeck({ ...data, verbs: [verb] }, random)();
  for (const tense of shuffled(chapter.tenses, random)) {
    const card = blankCard(bank, verb, tense, random);
    if (card) return card;
  }
  return conjugationDeck({ ...data, verbs: [verb], rare }, random)();
}

/**
 * The chapter's new verbs: first each one's meaning as a flashcard, then each one in a sentence to fill in, from the
 * sentences practice uses, so the checkpoint's stay unseen.
 */
export function verbsDeck(data: ChapterData, random: Random = Math.random): () => Card | null {
  const practice = withBank(data, "practice");
  const verbs = (data.chapter.newVerbs ?? []).flatMap((inf) => data.verbs.find((v) => v.inf === inf) ?? []);
  const meanings = shuffled(verbs, random).map((verb) => verbMeaningCard(practice, verb, random));
  const blanks = shuffled(verbs, random).flatMap((verb) => newVerbBlank(practice, verb, random) ?? []);
  return queue([...meanings, ...blanks]);
}

/** Every word once, as flashcards, in random order. */
export function wordsDeck(chapter: Chapter, random: Random = Math.random): () => Card | null {
  const cards = shuffled(chapter.words, random).flatMap((id) => listedWordCard(id, "flashcard", random) ?? []);
  return queue(cards);
}

/** Translations from the given part of the chapter's sentences, both ways. */
function translations(data: ChapterData, random: Random): () => Card | null {
  const { chapter, verbs, bank } = data;
  if (chapter.drills.includes("progressive")) return progressiveWritingDeck(data, random);
  return writingDeck(sentencesUpTo(bank, chapter.level), verbs, chapter.tenses, ["toEnglish", "toSpanish"], random);
}

export function writeDeck(data: ChapterData, random: Random = Math.random): () => Card | null {
  return queue(distinct(translations(withBank(data, "practice"), random), WRITE_SIZE));
}

/**
 * A mixed test on the chapter only: its drills, guide questions, its words typed, and sentences to translate, all from
 * the sentences Practice and Write leave out. When a part has nothing to ask, like phrases, which are never typed, the
 * others take its share. Missed questions don't come back, so the score is a first try.
 */
export function checkpointCards(data: ChapterData, random: Random = Math.random, size = CHECKPOINT_SIZE): Card[] {
  const { chapter, quiz, seen } = data;
  const held = withBank(data, "checkpoint");
  const sentences = new Set<string>();
  const quizPool = quiz ? freshestFirst(quizCards(quiz, random), seen, random) : [];
  const typed = shuffled(chapter.words, random).flatMap((id) => listedWordCard(id, "toSpanish", random) ?? []);
  const words = typed.slice(0, CHECKPOINT_MIX.words);
  const writes = chapterSteps(chapter).includes("write") ? distinct(translations(held, random), CHECKPOINT_MIX.write, sentences) : [];
  const drillShare = chapter.drills.length > 0 ? CHECKPOINT_MIX.verbs : 0;
  const quizCount = Math.min(quizPool.length, Math.max(CHECKPOINT_MIX.quiz, size - words.length - writes.length - drillShare));
  const drills = drillShare ? distinct(drillDeck(held, random), size - words.length - writes.length - quizCount, sentences) : [];
  // A chapter with few sentences can come up short; more of its quiz, then more words, make up the rest.
  let short = size - words.length - writes.length - quizCount - drills.length;
  const moreQuiz = quizPool.slice(quizCount, quizCount + Math.max(0, short));
  short -= moreQuiz.length;
  const moreWords = typed.slice(words.length, words.length + Math.max(0, short));
  return shuffled([...drills, ...quizPool.slice(0, quizCount), ...moreQuiz, ...words, ...moreWords, ...writes], random);
}

export const checkpointDeck = (data: ChapterData, random: Random = Math.random) => queue(checkpointCards(data, random));

/**
 * A review checkpoint: questions from every chapter it covers, built like each chapter's checkpoint, so from the
 * sentences each chapter held back. The recent chapters get REVIEW_RECENT_SHARE of them and the earlier ones the rest,
 * spread evenly within each group. Missed questions don't come back.
 */
export function reviewCards(chapters: ChapterData[], recent: Set<string>, size = REVIEW_SIZE, random: Random = Math.random): Card[] {
  const pools = chapters.map((data) => ({ recent: recent.has(data.chapter.id), cards: checkpointCards(data, random) }));
  const taken = new Set<string>();
  const sentences = new Set<string>();
  const picked: Card[] = [];
  const draw = (group: typeof pools, count: number) => {
    const start = Math.floor(random() * Math.max(1, group.length));
    const goal = picked.length + count;
    for (let progress = true; picked.length < goal && progress; ) {
      progress = false;
      for (let i = 0; i < group.length && picked.length < goal; i++) {
        const pool = group[(start + i) % group.length].cards;
        while (pool.length > 0) {
          const card = pool.shift()!;
          const es = spanishOf(card);
          if (taken.has(cardKey(card)) || (es && sentences.has(es))) continue;
          taken.add(cardKey(card));
          if (es) sentences.add(es);
          picked.push(card);
          progress = true;
          break;
        }
      }
    }
  };
  const newer = pools.filter((p) => p.recent);
  const older = pools.filter((p) => !p.recent);
  draw(newer, older.length ? Math.round(size * REVIEW_RECENT_SHARE) : size);
  draw(older, size - picked.length);
  // Either group can run out, and the other makes up the rest.
  draw(newer, size - picked.length);
  return shuffled(picked, random);
}

export const reviewDeck = (chapters: ChapterData[], recent: Set<string>, random: Random = Math.random) => queue(reviewCards(chapters, recent, REVIEW_SIZE, random));

/**
 * A level exam: questions from each chapter's quiz in turn, so every chapter gets about the same share, then shuffled.
 * A question two chapters share counts for the first, and questions not asked lately come first. Missed questions
 * don't come back, as in a checkpoint.
 */
export function examCards(quizzes: ChapterQuiz[], size = EXAM_SIZE, random: Random = Math.random, seen: QuizSeen = {}): Card[] {
  const taken = new Set<string>();
  const pools = quizzes.map((quiz) =>
    freshestFirst(
      quiz.questions
        .filter(({ index }) => !taken.has(`${quiz.slug}:${index}`) && !!taken.add(`${quiz.slug}:${index}`))
        .map(({ index, question }) => quizCard(quiz.slug, index, quiz.title, question, random)),
      seen,
      random,
    ),
  );
  // Which chapter goes first changes each time, so a short pool doesn't always favor the early chapters.
  const start = Math.floor(random() * Math.max(1, pools.length));
  const picked: Card[] = [];
  for (let round = 0; picked.length < size && pools.some((p) => p.length > round); round++) {
    for (let i = 0; i < pools.length && picked.length < size; i++) {
      const card = pools[(start + i) % pools.length][round];
      if (card) picked.push(card);
    }
  }
  return shuffled(picked, random);
}

/** A level exam, with `reviewCount` of its questions drawn from earlier levels' quizzes, when it has any. */
export function examWithReview(
  quizzes: ChapterQuiz[],
  review: ChapterQuiz[] = [],
  reviewCount = 0,
  random: Random = Math.random,
  seen: QuizSeen = {},
): Card[] {
  // A guide can be at two levels, like the perfect tenses at B1 and B2, so review leaves out the level's own questions.
  const own = new Set(quizzes.flatMap((q) => q.questions.map(({ index }) => `${q.slug}:${index}`)));
  const others = review.map((q) => ({ ...q, questions: q.questions.filter(({ index }) => !own.has(`${q.slug}:${index}`)) }));
  const earlier = reviewCount > 0 ? examCards(others, reviewCount, random, seen) : [];
  return shuffled([...examCards(quizzes, EXAM_SIZE - earlier.length, random, seen), ...earlier], random);
}

export const examDeck = (quizzes: ChapterQuiz[], review: ChapterQuiz[], reviewCount: number, seen: QuizSeen = {}, random: Random = Math.random) =>
  queue(examWithReview(quizzes, review, reviewCount, random, seen));

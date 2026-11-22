import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listedWordCard } from "./card-decks";
import { TENSES, type TenseId } from "./conjugation/types";
import { conjugate } from "./conjugation/engine";
import { findReading } from "./reading-data";
import {
  CHAPTERS,
  CHECKPOINT_SIZE,
  EXAM_LEVELS,
  EXAM_REVIEW,
  EXAM_SIZE,
  REVIEWS,
  REVIEW_SIZE,
  chapterForReading,
  chapterSteps,
  findReview,
  levelChapters,
  levelComplete,
  mergeCourse,
  nextStep,
  parseCourse,
  recentChapters,
  reviewChapters,
  stepsLeft,
  suggestedChapter,
  type CourseProgress,
  type StepId,
} from "./course";
import {
  TENSE_MEANINGS,
  checkpointCards,
  examCards,
  examWithReview,
  heldForCheckpoint,
  practiceDeck,
  progressiveForm,
  quizCards,
  reviewCards,
  writeDeck,
  type ChapterData,
  type ChapterQuiz,
} from "./course-decks";
import { findGuide } from "./guides";
import { LEVELS } from "./level";
import { quizPlace } from "./quiz";
import { GUIDE_QUIZZES } from "./quiz-data";
import { chapterSentences } from "./chapter-quiz";
import courseSentences from "../data/course-sentences.json";
import { SENTENCE_BANK } from "./sentence-data";
import { findForm, sentencesFor, withExtraSentences, type Sentence, type SentenceBank } from "./sentences";
import { findVerb } from "./verbs";
import { upToLevel, type LeveledType } from "./vocab";

// Seeded, so a failure can be repeated.
function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
}

const LEVEL_IDS = LEVELS.map((l) => l.id);
const TENSE_IDS = new Set(TENSES.map((t) => t.id));

function chapterQuiz(slug: string, picked?: number[]): ChapterQuiz | null {
  const all = GUIDE_QUIZZES[slug] ?? [];
  const indexes = picked ?? all.map((_, i) => i);
  return indexes.length ? { slug, title: findGuide(slug)!.title, questions: indexes.map((index) => ({ index, question: all[index] })) } : null;
}

function chapterData(chapter: (typeof CHAPTERS)[number]): ChapterData {
  const rare = new Set(
    chapter.verbs.flatMap((inf) =>
      Object.entries(SENTENCE_BANK[inf] ?? {})
        .filter(([, e]) => e && "rare" in e)
        .map(([t]) => `${inf}:${t}`),
    ),
  );
  return {
    chapter,
    verbs: chapter.verbs.map((inf) => findVerb(inf)!),
    bank: withExtraSentences(SENTENCE_BANK, chapterSentences(chapter.id)),
    rare,
    quiz: chapter.guide ? chapterQuiz(chapter.guide.slug, chapter.guide.quiz) : null,
  };
}

describe("course chapters", () => {
  it("have unique ids and go up in level", () => {
    assert.equal(new Set(CHAPTERS.map((c) => c.id)).size, CHAPTERS.length);
    const ranks = CHAPTERS.map((c) => LEVEL_IDS.indexOf(c.level));
    assert.ok(ranks.every((r) => r >= 0));
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  });

  it("name verbs, tenses and model verbs that exist", () => {
    for (const c of CHAPTERS) {
      assert.ok(c.tenses.every((t) => TENSE_IDS.has(t)), c.id);
      const verbDrills = c.drills.some((d) => d === "conjugation" || d === "blanks" || d === "chooseVerb");
      assert.ok(!verbDrills || (c.tenses.length > 0 && c.verbs.length > 0), `${c.id} drills verbs but names none`);
      for (const inf of c.verbs) assert.equal(findVerb(inf)?.inf, inf, `${c.id}: ${inf}`);
      assert.equal(new Set(c.verbs).size, c.verbs.length, `${c.id} lists a verb twice`);
      for (const inf of c.models ?? []) {
        assert.ok(c.verbs.includes(inf), `${c.id}: model ${inf} isn't one of its verbs`);
        for (const tense of c.tenses) assert.ok(conjugate(findVerb(inf)!).tenses[tense]?.forms.some(Boolean), `${c.id}: ${inf} has no ${tense}`);
      }
    }
  });

  it("use words that exist, once each, at or below the chapter's level", () => {
    for (const c of CHAPTERS) {
      assert.equal(new Set(c.words).size, c.words.length, `${c.id} lists a word twice`);
      for (const id of c.words) {
        const [type, es] = id.split(":");
        assert.ok(listedWordCard(id, "flashcard"), `${c.id}: no word ${id}`);
        // Phrases have no level and are never typed.
        if (type === "phrase") continue;
        assert.ok(listedWordCard(id, "toSpanish"), `${c.id}: no typed card for ${id}`);
        assert.ok(upToLevel(c.level, type as LeveledType, es), `${c.id}: ${id} is above ${c.level}`);
      }
      if (c.lesson) assert.equal(c.words.length + c.drills.filter((d) => d !== "numbers").length + c.verbs.length, 0, `${c.id} is a short lesson`);
      else assert.ok(c.words.length >= 12 && c.words.length <= 25, `${c.id} has ${c.words.length} words`);
    }
  });

  it("point to guide sections and quiz questions that exist", () => {
    for (const c of CHAPTERS.filter((ch) => ch.guide)) {
      const guide = findGuide(c.guide!.slug);
      assert.ok(guide, `${c.id}: no guide ${c.guide!.slug}`);
      const headings = guide.sections.map((s) => s.heading);
      for (const h of c.guide!.sections ?? []) assert.ok(headings.includes(h), `${c.id}: no section "${h}"`);
      const quiz = GUIDE_QUIZZES[guide.slug];
      assert.ok(quiz?.length, `${c.id}: the guide has no quiz`);
      for (const i of c.guide!.quiz ?? []) assert.ok(quiz[i], `${c.id}: no question ${i}`);
    }
  });

  it("add their own sentences only for their verbs and tenses, each with the right form", () => {
    for (const [id, verbs] of Object.entries(courseSentences as Record<string, SentenceBank>)) {
      const c = CHAPTERS.find((ch) => ch.id === id);
      assert.ok(c, `${id} isn't a chapter`);
      for (const [inf, tenses] of Object.entries(verbs)) {
        assert.ok(c.verbs.includes(inf), `${id}: ${inf}`);
        for (const [tense, rows] of Object.entries(tenses) as [TenseId, Sentence[]][]) {
          assert.ok(c.tenses.includes(tense), `${id}: ${tense}`);
          const bank = new Set(sentencesFor(SENTENCE_BANK, inf, tense).map((s) => s.es));
          for (const s of rows) {
            // The present progressive's sentences are kept under the present, with estar and the gerund in them.
            const form = c.drills.includes("progressive") ? progressiveForm(findVerb(inf)!, s.person) : conjugate(findVerb(inf)!).tenses[tense]?.forms[s.person];
            assert.ok(form && findForm(s.es, form), `${id}: "${s.es}" lacks ${form}`);
            assert.ok(/[.?!]$/.test(s.es) && /[.?!]$/.test(s.en), s.es);
            assert.ok(!bank.has(s.es), `${id}: "${s.es}" is already in the bank`);
          }
        }
      }
    }
  });

  it("always end in a checkpoint and have something to practice", () => {
    for (const c of CHAPTERS) {
      const steps = chapterSteps(c);
      assert.equal(steps.at(-1), "checkpoint", c.id);
      assert.ok(steps.includes("practice") || steps.includes("quiz"), c.id);
    }
  });

  it("have their own reading at their level, one chapter to a passage, and none for short lessons", () => {
    const used = new Set<string>();
    for (const c of CHAPTERS.filter((ch) => ch.reading)) {
      const reading = findReading(c.reading!);
      assert.ok(reading, `${c.id}: no reading ${c.reading}`);
      assert.equal(reading.level, c.level, c.id);
      assert.ok(!c.lesson, `${c.id} is a short lesson`);
      assert.ok(!used.has(c.reading!), `${c.reading} is in two chapters`);
      used.add(c.reading!);
      assert.equal(chapterForReading(c.reading!), c);
    }
  });

  it("name steps still to do in a finished chapter, like one added after it was passed", () => {
    const c = CHAPTERS.find((ch) => ch.id === "present-regular")!;
    const before: StepId[] = ["learn", "see", "quiz", "words", "practice", "write", "checkpoint"];
    assert.deepEqual(stepsLeft(c, { [c.id]: { steps: before, done: "2026-11-10", best: 90 } }), ["read"]);
    assert.deepEqual(stepsLeft(c, { [c.id]: { steps: [...before, "read"], done: "2026-11-10", best: 90 } }), []);
    // Unfinished chapters already show a step count.
    assert.deepEqual(stepsLeft(c, { [c.id]: { steps: ["learn"] } }), []);
  });

  it("count a level complete when every chapter has its badge and every step done, whatever the scores or exam", () => {
    // 80 passes, so a score under 100 still counts.
    const passed = (c: (typeof CHAPTERS)[number]) => ({ steps: chapterSteps(c), done: "2026-11-10", best: 80 });
    const all: CourseProgress = Object.fromEntries(levelChapters("A1").map((c) => [c.id, passed(c)]));
    assert.equal(levelComplete("A1", all), true);
    const first = levelChapters("A1")[0];
    const missingRead = { ...all, [first.id]: { ...passed(first), steps: chapterSteps(first).filter((s) => s !== "read") } };
    assert.equal(levelComplete("A1", missingRead), false, "a step still to do");
    const noBadge = { ...all, [first.id]: { steps: chapterSteps(first).filter((s) => s !== "checkpoint"), best: 60 } };
    assert.equal(levelComplete("A1", noBadge), false, "a checkpoint not passed");
    assert.equal(levelComplete("A2", all), false);
  });

  it("put the reading between the typed steps", () => {
    const c = CHAPTERS.find((ch) => ch.id === "present-regular")!;
    assert.deepEqual(chapterSteps(c), ["learn", "see", "quiz", "words", "practice", "read", "write", "checkpoint"]);
  });
});

describe("chapter decks", () => {
  it("practice stays on the chapter's verbs and tenses", () => {
    for (const c of CHAPTERS.filter((ch) => ch.drills.some((d) => d === "conjugation" || d === "blanks" || d === "choose" || d === "chooseVerb"))) {
      const deck = practiceDeck(chapterData(c), seeded(5));
      let count = 0;
      const asked = new Set<string>();
      for (let card = deck(); card; card = deck()) {
        count++;
        assert.ok(!asked.has(`${card.id}|${card.title}`), `${c.id} repeats ${card.id}`);
        asked.add(`${card.id}|${card.title}`);
        const [source, inf, tense] = card.track!.item.split(":");
        assert.equal(source, "verb", card.id);
        assert.ok(c.verbs.includes(inf) && c.tenses.includes(tense as never), `${c.id}: ${card.track!.item}`);
      }
      assert.equal(count, 15, c.id);
    }
  });

  it("tense choice hides the tense until it's answered", () => {
    const c = CHAPTERS.find((ch) => ch.drills.includes("choose"))!;
    const deck = practiceDeck(chapterData(c), seeded(4));
    const names = TENSES.map((t) => t.name);
    const seen = new Set<string>();
    for (let card = deck(); card; card = deck()) {
      assert.ok(!names.includes(card.badge!) && !names.some((n) => card.context?.includes(n)), card.badge);
      assert.ok(card.explain?.includes(TENSES.find((t) => t.id === card.track!.tense)!.name.toLowerCase()), card.explain);
      seen.add(card.track!.tense!);
    }
    assert.deepEqual([...seen].sort(), [...c.tenses].sort());
  });

  it("tense choice says how conocer, saber, poder and querer change meaning", () => {
    const c = CHAPTERS.find((ch) => ch.id === "preterite-vs-imperfect-meaning")!;
    const found = new Set<string>();
    for (let s = 1; s <= 40; s++) {
      const deck = practiceDeck(chapterData(c), seeded(s));
      for (let card = deck(); card; card = deck()) {
        const meaning = TENSE_MEANINGS[card.track!.item];
        if (meaning) found.add(card.track!.item);
        assert.ok(!meaning || card.explain!.endsWith(meaning), card.explain);
      }
    }
    assert.ok(found.size > 0, "no meaning-change card dealt");
  });

  it("verb choice hides the verb until it's answered", () => {
    const c = CHAPTERS.find((ch) => ch.drills.includes("chooseVerb"))!;
    const deck = practiceDeck(chapterData(c), seeded(6));
    const seen = new Set<string>();
    for (let card = deck(); card; card = deck()) {
      const inf = card.track!.item.split(":")[1];
      assert.ok(!card.ask.includes(inf), card.ask);
      assert.equal(card.explain, `This sentence takes ${inf}.`);
      seen.add(inf);
    }
    assert.deepEqual([...seen].sort(), [...c.verbs].sort());
  });

  it("gender and agreement practice stays on the chapter's nouns and adjectives", () => {
    for (const c of CHAPTERS.filter((ch) => ch.drills.includes("gender"))) {
      const deck = practiceDeck(chapterData(c), seeded(3));
      const kinds = new Set<string>();
      let count = 0;
      for (let card = deck(); card; card = deck()) {
        count++;
        const [source, type, es, kind] = card.track!.item.split(":");
        kinds.add(kind);
        assert.equal(source, "vocab", card.id);
        assert.ok(c.words.includes(`${type}:${es}`), `${c.id}: ${card.track!.item}`);
      }
      assert.equal(count, 15, c.id);
      assert.deepEqual([...kinds].sort(), [...c.drills].sort(), c.id);
    }
  });

  it("writing gives six sentences from the chapter's tenses", () => {
    for (const c of CHAPTERS.filter((ch) => chapterSteps(ch).includes("write"))) {
      const deck = writeDeck(chapterData(c), seeded(9));
      let count = 0;
      const asked = new Set<string>();
      for (let card = deck(); card; card = deck()) {
        count++;
        assert.ok(!asked.has(card.title), `${c.id} repeats ${card.title}`);
        asked.add(card.title);
      }
      assert.equal(count, 6, c.id);
    }
  });

  it("checkpoints mix 25 different questions from the chapter only", () => {
    for (const c of CHAPTERS) {
      const data = chapterData(c);
      const cards = checkpointCards(data, seeded(11));
      // A short lesson with no practice only has its quiz, which can be smaller than a checkpoint.
      const quizSize = data.quiz?.questions.length ?? 0;
      assert.equal(cards.length, c.drills.length === 0 && c.words.length === 0 ? Math.min(CHECKPOINT_SIZE, quizSize) : CHECKPOINT_SIZE, c.id);
      assert.equal(new Set(cards.map((card) => `${card.id}|${card.title}`)).size, cards.length, `${c.id} repeats a question`);
      const sentences = cards.map((card) => card.sentence ?? (card.writing ? (card.titleIsSpanish ? card.title : card.shown) : "")).filter(Boolean);
      assert.equal(new Set(sentences).size, sentences.length, `${c.id} asks a sentence twice`);
      const words = cards.filter((card) => card.track?.item.startsWith("vocab:") && card.badge === "English to Spanish");
      assert.ok(words.length >= 5 || c.words.every((w) => w.startsWith("phrase:")) || c.lesson, c.id);
      for (const card of cards.filter((x) => x.track?.item.startsWith("vocab:"))) assert.ok(c.words.includes(card.track!.item.split(":").slice(1, 3).join(":")), card.track!.item);
      if (chapterSteps(c).includes("write")) assert.equal(cards.filter((card) => card.writing).length, 4, `${c.id} translations`);
      for (const card of cards.filter((x) => x.track?.item.startsWith("verb:"))) assert.ok(c.verbs.includes(card.track!.item.split(":")[1]), `${c.id}: ${card.track!.item}`);
      for (const card of cards.filter((x) => x.track?.item.startsWith("quiz:"))) assert.ok(card.id.startsWith(`quiz:${c.guide!.slug}:`), card.id);
    }
  });

  it("checkpoints use only sentences that practice and writing leave out", () => {
    for (const c of CHAPTERS.filter((ch) => chapterSteps(ch).includes("write"))) {
      const data = chapterData(c);
      const shown = new Set<string>();
      for (let s = 1; s <= 6; s++) {
        for (const deck of [practiceDeck(data, seeded(s)), writeDeck(data, seeded(s))]) {
          for (let card = deck(); card; card = deck()) {
            const es = card.sentence ?? (card.writing ? (card.titleIsSpanish ? card.title : card.shown) : undefined);
            if (es) shown.add(es);
          }
        }
      }
      for (let s = 1; s <= 6; s++) {
        for (const card of checkpointCards(data, seeded(s))) {
          const es = card.sentence ?? (card.writing ? (card.titleIsSpanish ? card.title : card.shown) : undefined);
          if (es) {
            assert.ok(!shown.has(es), `${c.id}: "${es}" was in practice or writing too`);
            assert.ok(heldForCheckpoint(c.id, es), `${c.id}: "${es}" isn't held back`);
          }
        }
      }
    }
  });

  it("keep to the chapter's persons when it names some, like tú for the first commands chapter", () => {
    for (const c of CHAPTERS.filter((ch) => ch.persons)) {
      const data = chapterData(c);
      for (let s = 1; s <= 4; s++) {
        for (const card of [...checkpointCards(data, seeded(s))]) {
          if (!card.track?.item.startsWith("verb:")) continue;
          const person = card.table?.person;
          assert.ok(person !== undefined && c.persons!.includes(person), `${c.id}: ${card.id}`);
        }
        const deck = practiceDeck(data, seeded(s));
        let count = 0;
        for (let card = deck(); card; card = deck()) {
          count++;
          assert.ok(c.persons!.includes(card.table!.person), `${c.id}: ${card.id}`);
        }
        assert.equal(count, 15, c.id);
      }
    }
  });

  it("present progressive practice asks for estar plus the gerund", () => {
    const c = CHAPTERS.find((ch) => ch.drills.includes("progressive"))!;
    const data = chapterData(c);
    const deck = practiceDeck(data, seeded(2));
    let count = 0;
    const kinds = new Set<string>();
    for (let card = deck(); card; card = deck()) {
      count++;
      const [, second, inf, person] = card.id.split(":");
      const verb = findVerb(second === "blank" ? inf : second)!;
      const p = Number(second === "blank" ? person : inf);
      kinds.add(second === "blank" ? "blank" : "form");
      assert.equal(card.answers[0].toLowerCase(), progressiveForm(verb, p), card.id);
      assert.ok(c.verbs.includes(verb.inf), card.id);
      assert.equal(card.track?.item, "progressive:present");
    }
    assert.equal(count, 15);
    assert.deepEqual([...kinds].sort(), ["blank", "form"]);
    assert.equal(progressiveForm(findVerb("leer")!, 0), "estoy leyendo");
    assert.equal(progressiveForm(findVerb("dormir")!, 3), "estamos durmiendo");
    const writing = writeDeck(data, seeded(3));
    for (let card = writing(); card; card = writing()) assert.equal(card.context, "Present progressive");
  });

  it("keeps each quiz question's place in the guide, so it's saved as the same item", () => {
    const quiz = chapterQuiz("talking-about-the-future", [0, 4, 9])!;
    assert.deepEqual(
      quizCards(quiz).map((c) => c.track!.item),
      ["quiz:talking-about-the-future:0", "quiz:talking-about-the-future:4", "quiz:talking-about-the-future:9"],
    );
  });
});

describe("review checkpoints", () => {
  it("each follow a chapter, two or three in a level with none at B2, and none right before an exam", () => {
    assert.ok(REVIEWS.length > 0);
    for (const r of REVIEWS) {
      const c = CHAPTERS.find((ch) => ch.id === r.after);
      assert.ok(c, r.after);
      assert.equal(c.level, r.level);
      assert.notEqual(levelChapters(r.level).at(-1), c, `${r.id} sits right before the exam`);
      assert.equal(findReview(r.slug), r);
    }
    assert.equal(new Set(REVIEWS.map((r) => r.id)).size, REVIEWS.length);
    assert.ok(!REVIEWS.some((r) => r.level === "B2"));
    assert.deepEqual(REVIEWS.filter((r) => r.level === "A1").map((r) => r.number), [1, 2]);
  });

  it("cover the course so far, with the chapters since the last review counted as recent", () => {
    const [first, second] = REVIEWS;
    assert.deepEqual(reviewChapters(first).map((c) => c.id), CHAPTERS.slice(0, 3).map((c) => c.id));
    assert.deepEqual(recentChapters(first), reviewChapters(first));
    const recent = recentChapters(second);
    assert.equal(recent[0], CHAPTERS[3]);
    assert.equal(recent.at(-1)!.id, second.after);
    // A level's first review starts its recent chapters at the level, not at the last level's review.
    const firstA2 = REVIEWS.find((r) => r.level === "A2")!;
    assert.equal(recentChapters(firstA2)[0], levelChapters("A2")[0]);
  });

  it("ask 30 different questions, mostly from the recent chapters, from held-back sentences", () => {
    for (const review of REVIEWS) {
      const chapters = reviewChapters(review);
      const recent = new Set(recentChapters(review).map((c) => c.id));
      const cards = reviewCards(chapters.map(chapterData), recent, REVIEW_SIZE, seeded(13));
      assert.equal(cards.length, REVIEW_SIZE, review.id);
      assert.equal(new Set(cards.map((card) => `${card.id}|${card.title}`)).size, cards.length, `${review.id} repeats a question`);
      // A card could have come from a chapter when its guide question, word, or verb and tense is that chapter's.
      // Recent chapters get 60%, so at least that many cards fit one of them, and some fit only earlier ones.
      const fits = (card: (typeof cards)[number], c: (typeof chapters)[number]) => {
        const item = card.track?.item ?? "";
        const [source, a, b] = item.split(":");
        if (source === "quiz") return card.id.startsWith(`quiz:${c.guide?.slug}:`) && chapterData(c).quiz!.questions.some((q) => `quiz:${c.guide!.slug}:${q.index}` === card.id);
        if (source === "vocab") return c.words.includes(`${a}:${b}`);
        if (source === "verb") return c.verbs.includes(a) && c.tenses.includes(b as TenseId);
        if (source === "progressive") return c.drills.includes("progressive");
        if (source === "number") return c.drills.includes("numbers");
        // Translations: the verb and tense are in the card's id.
        if (source === "writing") {
          const [, , inf, tense] = card.id.split(":");
          return c.verbs.includes(inf) && (c.tenses.includes(tense as TenseId) || (tense === "progressive" && c.drills.includes("progressive")));
        }
        return false;
      };
      const recentOnes = chapters.filter((c) => recent.has(c.id));
      const earlierOnes = chapters.filter((c) => !recent.has(c.id));
      const fromRecent = cards.filter((card) => recentOnes.some((c) => fits(card, c))).length;
      assert.ok(fromRecent >= REVIEW_SIZE * 0.6, `${review.id}: ${fromRecent} of ${cards.length} from recent chapters`);
      if (earlierOnes.length) assert.ok(cards.some((card) => !recentOnes.some((c) => fits(card, c)) && earlierOnes.some((c) => fits(card, c))), `${review.id} has nothing earlier`);
      assert.ok(cards.every((card) => chapters.some((c) => fits(card, c))), `${review.id} asks something from no covered chapter`);
    }
  });
});

describe("level exams", () => {
  it("ask up to 40 different questions spread across every chapter at the level", () => {
    for (const level of EXAM_LEVELS) {
      const quizzes = levelChapters(level).flatMap((c) => (c.guide ? (chapterQuiz(c.guide.slug, c.guide.quiz) ?? []) : []));
      const cards = examCards(quizzes, EXAM_SIZE, seeded(7));
      const pool = new Set(quizzes.flatMap((q) => q.questions.map(({ index }) => `${q.slug}:${index}`))).size;
      assert.equal(cards.length, Math.min(EXAM_SIZE, pool), level);
      assert.equal(new Set(cards.map((c) => c.id)).size, cards.length, level);
      assert.ok(cards.every((c) => c.track?.item?.startsWith("quiz:")), level);
      // Every guide in the level is asked about, and none takes much more than its share.
      const slugs = new Set(quizzes.map((q) => q.slug));
      // Per chapter: two B1 chapters share the subjunctive guide.
      const counts = [...slugs].map(
        (slug) => cards.filter((c) => c.id.startsWith(`quiz:${slug}:`)).length / quizzes.filter((q) => q.slug === slug).length,
      );
      assert.ok(counts.every((n) => n > 0), level);
      // A chapter can fall short only by running out of questions, and the others make up the rest.
      const most = Math.max(...counts);
      [...slugs].forEach((slug, i) => {
        const pool = new Set(quizzes.filter((q) => q.slug === slug).flatMap((q) => q.questions.map(({ index }) => index))).size;
        const asked = cards.filter((c) => c.id.startsWith(`quiz:${slug}:`)).length;
        assert.ok(counts[i] >= most - 1 || asked === pool, `${level}: ${slug} ${asked} of ${pool}, counts ${counts}`);
      });
    }
  });

  it("review earlier levels where set, without repeating the level's own questions", () => {
    const quizzesAt = (level: string) => CHAPTERS.filter((c) => c.level === level && c.guide).flatMap((c) => chapterQuiz(c.guide!.slug, c.guide!.quiz) ?? []);
    const own = quizzesAt("B2");
    const earlier = ["A1", "A2", "B1"].flatMap(quizzesAt);
    const cards = examWithReview(own, earlier, EXAM_REVIEW.B2!, seeded(5));
    const ownIds = new Set(own.flatMap((q) => q.questions.map(({ index }) => `quiz:${q.slug}:${index}`)));
    const reviewed = cards.filter((c) => !ownIds.has(c.id));
    assert.equal(reviewed.length, EXAM_REVIEW.B2);
    assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
    // One per chapter, and a few chapters share a guide, so nearly every review question is from a different guide.
    assert.ok(new Set(reviewed.map((c) => quizPlace(c)![0])).size >= reviewed.length - 2);
  });

  it("count a question two chapters share only once", () => {
    const quiz = chapterQuiz("subjunctive")!;
    const cards = examCards([quiz, quiz], 100, seeded(3));
    assert.equal(cards.length, quiz.questions.length);
  });
});

describe("course progress", () => {
  const [first, second] = CHAPTERS;

  it("merges two copies without losing anything", () => {
    const a: CourseProgress = { [first.id]: { steps: ["learn", "words"], best: 70, tries: [{ day: "2026-11-01", score: 70 }], at: 5 } };
    const b: CourseProgress = {
      [first.id]: { steps: ["see", "checkpoint"], best: 90, done: "2026-11-03", tries: [{ day: "2026-11-01", score: 70 }, { day: "2026-11-03", score: 90 }], at: 9 },
      [second.id]: { steps: ["learn"] },
    };
    const merged = mergeCourse(a, b);
    assert.deepEqual(merged[first.id], {
      steps: ["learn", "see", "words", "checkpoint"],
      best: 90,
      done: "2026-11-03",
      tries: [{ day: "2026-11-01", score: 70 }, { day: "2026-11-03", score: 90 }],
      at: 9,
    });
    assert.deepEqual(merged[second.id], { steps: ["learn"] });
    assert.deepEqual(mergeCourse(merged, merged), merged);
  });

  it("drops what it can't read", () => {
    assert.deepEqual(parseCourse(null), {});
    assert.deepEqual(parseCourse({ x: { steps: ["learn", "nap"], best: "90", done: "soon", tries: [{ day: "2026-11-01" }], at: 3 } }), {
      x: { steps: ["learn"], at: 3 },
    });
  });

  it("suggests the next step and chapter", () => {
    assert.equal(nextStep(first, {}), chapterSteps(first)[0]);
    assert.equal(nextStep(first, { [first.id]: { steps: ["see"], done: "2026-11-01" } }), null);
    assert.equal(suggestedChapter({}, null), first);
    assert.equal(suggestedChapter({}, "A2")!.level, "A2");
    assert.equal(suggestedChapter({ [second.id]: { steps: ["learn"], at: 1 } }, "B1"), second);
    assert.equal(suggestedChapter({ [first.id]: { steps: [], done: "2026-11-01", at: 2 } }, null), second);
  });
});

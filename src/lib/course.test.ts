import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listedWordCard } from "./card-decks";
import { TENSES } from "./conjugation/types";
import { conjugate } from "./conjugation/engine";
import { CHAPTERS, chapterSteps, mergeCourse, nextStep, parseCourse, suggestedChapter, type CourseProgress } from "./course";
import { checkpointCards, practiceDeck, quizCards, writeDeck, type ChapterData, type ChapterQuiz } from "./course-decks";
import { findGuide } from "./guides";
import { LEVELS } from "./level";
import { GUIDE_QUIZZES } from "./quiz-data";
import { SENTENCE_BANK } from "./sentence-data";
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
    bank: SENTENCE_BANK,
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
      const verbDrills = c.drills.some((d) => d === "conjugation" || d === "blanks");
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
      if (c.lesson) assert.equal(c.words.length + c.drills.length + c.verbs.length, 0, `${c.id} is a short lesson`);
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

  it("always end in a checkpoint and have something to practice", () => {
    for (const c of CHAPTERS) {
      const steps = chapterSteps(c);
      assert.equal(steps.at(-1), "checkpoint", c.id);
      assert.ok(steps.includes("practice") || steps.includes("quiz"), c.id);
    }
  });
});

describe("chapter decks", () => {
  it("practice stays on the chapter's verbs and tenses", () => {
    for (const c of CHAPTERS.filter((ch) => ch.drills.includes("conjugation") || ch.drills.includes("blanks"))) {
      const deck = practiceDeck(chapterData(c), seeded(5));
      let count = 0;
      for (let card = deck(); card; card = deck()) {
        count++;
        const [source, inf, tense] = card.track!.item.split(":");
        assert.equal(source, "verb", card.id);
        assert.ok(c.verbs.includes(inf) && c.tenses.includes(tense as never), `${c.id}: ${card.track!.item}`);
      }
      assert.equal(count, 15, c.id);
    }
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
      for (let card = deck(); card; card = deck()) count++;
      assert.equal(count, 6, c.id);
    }
  });

  it("checkpoints mix about 15 different questions from the chapter", () => {
    for (const c of CHAPTERS) {
      const cards = checkpointCards(chapterData(c), seeded(11));
      assert.ok(cards.length >= 12 && cards.length <= 15, `${c.id}: ${cards.length}`);
      assert.equal(new Set(cards.map((card) => card.id)).size, cards.length, `${c.id} repeats a question`);
      const typed = cards.filter((card) => card.badge === "English to Spanish");
      assert.ok(typed.length >= 4 || c.words.every((w) => w.startsWith("phrase:")), c.id);
      const words = cards.filter((card) => card.track?.item.startsWith("vocab:"));
      for (const card of words) assert.ok(c.words.includes(card.track!.item.split(":").slice(1, 3).join(":")), card.track!.item);
    }
  });

  it("keeps each quiz question's place in the guide, so it's saved as the same item", () => {
    const quiz = chapterQuiz("talking-about-the-future", [0, 4, 9])!;
    assert.deepEqual(
      quizCards(quiz).map((c) => c.track!.item),
      ["quiz:talking-about-the-future:0", "quiz:talking-about-the-future:4", "quiz:talking-about-the-future:9"],
    );
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

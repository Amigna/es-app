import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gradeCard } from "./drill";
import { GUIDES } from "./guides";
import { freshestFirst, quizCard, quizDeck, quizPlace, shuffled, type QuizQuestion } from "./quiz";
import { GUIDE_QUIZZES } from "./quiz-data";

describe("quiz data", () => {
  it("covers every guide, and only real guides", () => {
    assert.deepEqual(Object.keys(GUIDE_QUIZZES).sort(), GUIDES.map((g) => g.slug).sort());
    for (const [slug, questions] of Object.entries(GUIDE_QUIZZES)) assert.ok(questions.length >= 10, slug);
  });

  it("ties every question to a rule in its guide, to show after a miss", () => {
    for (const [slug, questions] of Object.entries(GUIDE_QUIZZES)) {
      questions.forEach((q, i) => assert.equal(q.lesson?.rule, q.rule, `${slug} ${i}: no rule "${q.rule}"`));
    }
  });

  it("has well-formed questions", () => {
    for (const [slug, questions] of Object.entries(GUIDE_QUIZZES)) {
      const seen = new Set<string>();
      for (const q of questions) {
        const label = `${slug}: ${q.q}`;
        const key = `${q.q}|${q.en}`;
        assert.ok(!seen.has(key), `duplicate ${label}`);
        seen.add(key);
        assert.ok(q.q && q.en && q.answer && q.why, label);
        if (q.choices) {
          assert.ok(q.choices.length >= 2, label);
          assert.ok(q.choices.includes(q.answer), `answer not in choices: ${label}`);
          assert.equal(new Set(q.choices).size, q.choices.length, label);
        }
      }
    }
  });

  it("gives every blank question a blank", () => {
    for (const questions of Object.values(GUIDE_QUIZZES)) {
      for (const q of questions) {
        if (!q.q.endsWith("means:")) assert.ok(q.q.includes("_____"), q.q);
      }
    }
  });
});

describe("quiz cards", () => {
  const question: QuizQuestion = { q: "_____ la una.", en: "It's one.", choices: ["Es", "Son"], answer: "Es", why: "Singular." };

  it("marks only the right choice correct and keeps the explanation", () => {
    const card = quizCard("numbers-and-dates", 0, "Numbers", question);
    assert.equal(gradeCard(card, "Es"), "correct");
    assert.equal(gradeCard(card, "Son"), "wrong");
    assert.equal(card.explain, "Singular.");
    assert.equal(card.lesson, undefined);
  });

  it("carries the lesson's rule, to show after a miss, and never a link away", () => {
    const lesson = { rule: "Es la una", examples: [{ es: "Es la una.", en: "It's one." }] };
    const card = quizCard("numbers-and-dates", 0, "Numbers", { ...question, lesson });
    assert.deepEqual(card.lesson, lesson);
    assert.ok(!("link" in card));
  });

  it("deals every question once, then runs out", () => {
    const guides = GUIDES.slice(0, 2);
    const total = guides.reduce((n, g) => n + GUIDE_QUIZZES[g.slug].length, 0);
    const next = quizDeck(GUIDE_QUIZZES, guides);
    const ids = new Set<string>();
    for (let i = 0; i < total; i++) ids.add(next()!.id);
    assert.equal(ids.size, total);
    assert.equal(next(), null);
  });

  it("draws a run per guide, starting with questions not asked lately", () => {
    const guide = GUIDES[0];
    const count = GUIDE_QUIZZES[guide.slug].length;
    // Asked lately: everything but the last two, which were never asked.
    const seen = { [guide.slug]: Array.from({ length: count - 2 }, (_, i) => i) };
    const next = quizDeck(GUIDE_QUIZZES, [guide], Math.random, { seen, perGuide: 3 });
    const indexes = [next(), next(), next()].map((c) => quizPlace(c!)![1]).sort((a, b) => a - b);
    assert.equal(next(), null);
    assert.deepEqual(indexes, [0, count - 2, count - 1]);
  });

  it("puts never-asked questions first, then the ones asked longest ago", () => {
    const cards = [0, 1, 2, 3].map((i) => quizCard("x", i, "X", question));
    const order = freshestFirst(cards, { x: [2, 0, 3] }).map((c) => quizPlace(c)![1]);
    assert.deepEqual(order, [1, 2, 0, 3]);
  });

  it("shuffles without losing anything", () => {
    assert.deepEqual(shuffled([1, 2, 3, 4, 5]).sort(), [1, 2, 3, 4, 5]);
  });
});

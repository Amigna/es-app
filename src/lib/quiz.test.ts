import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gradeCard } from "./drill";
import { GUIDES } from "./guides";
import { quizCard, quizDeck, shuffled, type QuizQuestion } from "./quiz";
import { GUIDE_QUIZZES } from "./quiz-data";

describe("quiz data", () => {
  it("covers every guide, and only real guides", () => {
    assert.deepEqual(Object.keys(GUIDE_QUIZZES).sort(), GUIDES.map((g) => g.slug).sort());
    for (const [slug, questions] of Object.entries(GUIDE_QUIZZES)) assert.ok(questions.length >= 10, slug);
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
    assert.equal(card.link?.href, "/guides/numbers-and-dates");
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

  it("shuffles without losing anything", () => {
    assert.deepEqual(shuffled([1, 2, 3, 4, 5]).sort(), [1, 2, 3, 4, 5]);
  });
});

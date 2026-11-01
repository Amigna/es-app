import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gradeCard } from "./drill";
import { READINGS, findReading } from "./reading-data";
import { LEVELS, readingDeck, wordCount } from "./readings";

const passage = (slug: string) => findReading(slug)!.paragraphs.map((p) => p.es).join(" ");
const hasWord = (text: string, word: string) => new RegExp(`(?<!\\p{L})${word}(?!\\p{L})`, "iu").test(text);

describe("reading data", () => {
  it("has unique URL-safe slugs", () => {
    const slugs = READINGS.map((r) => r.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    for (const s of slugs) assert.match(s, /^[a-z-]+$/);
  });

  it("has passages at every level, within that level's length", () => {
    for (const level of LEVELS) {
      const passages = READINGS.filter((r) => r.level === level.id);
      assert.ok(passages.length > 0, level.id);
      for (const r of passages) {
        const n = wordCount(r);
        assert.ok(n >= level.minWords && n <= level.maxWords, `${r.slug} has ${n} words`);
      }
    }
  });

  it("translates every paragraph", () => {
    for (const r of READINGS) {
      assert.ok(r.title && r.en && r.place, r.slug);
      assert.ok(r.paragraphs.length > 0, r.slug);
      for (const p of r.paragraphs) assert.ok(p.es && p.en, r.slug);
    }
  });

  it("only lists words that appear in the passage", () => {
    for (const r of READINGS) {
      assert.ok(r.words.length >= 5, r.slug);
      for (const w of r.words) {
        assert.ok(w.en, `${r.slug}: ${w.es}`);
        assert.ok(hasWord(passage(r.slug), w.es), `${r.slug}: ${w.es}`);
      }
    }
  });

  it("has multiple-choice questions with one real answer", () => {
    for (const r of READINGS) {
      assert.ok(r.questions.length >= 4, r.slug);
      for (const q of r.questions) {
        const label = `${r.slug}: ${q.q}`;
        assert.ok(q.q && q.en && q.why, label);
        assert.ok(q.choices && q.choices.length >= 3, label);
        assert.ok(q.choices.includes(q.answer), label);
        assert.equal(new Set(q.choices).size, q.choices.length, label);
      }
    }
  });

  it("uses ustedes and avoids words that mean something else in Latin America", () => {
    for (const r of READINGS) {
      for (const word of ["vosotros", "vosotras", "coger", "coche", "ordenador", "móvil"]) {
        assert.ok(!hasWord(passage(r.slug), word), `${r.slug}: ${word}`);
      }
    }
  });
});

describe("reading questions", () => {
  const reading = READINGS[0];

  it("asks every question once, in passage order, then runs out", () => {
    const next = readingDeck(reading);
    for (const q of reading.questions) assert.equal(next()?.title, q.q);
    assert.equal(next(), null);
  });

  it("grades answers without saving them or linking away", () => {
    const card = readingDeck(reading)()!;
    assert.equal(gradeCard(card, reading.questions[0].answer), "correct");
    assert.equal(card.track, undefined);
    assert.equal(card.link, undefined);
  });
});

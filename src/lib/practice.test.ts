import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_PRACTICE_ITEMS, parsePractice, practiceHref, weakSpots } from "./practice";
import type { Tally } from "./progress";

const tally = (right: number, wrong: number, accent = 0): Tally => ({ right, accent, wrong });
const none = { total: tally(0, 0), tenses: {}, verbs: {}, kinds: {} };

describe("weakSpots", () => {
  it("lists the lowest accuracy first", () => {
    const spots = weakSpots({ ...none, tenses: { preterite: tally(6, 4), subjPresent: tally(2, 8), present: tally(7, 3) } });
    assert.deepEqual(spots.tenses.map((s) => s.key), ["subjPresent", "preterite", "present"]);
    assert.equal(spots.tenses[0].label, "Present subjunctive");
    assert.equal(spots.tenses[0].detail, "20% correct of 10");
    assert.deepEqual(spots.tenses[0].target, { tenses: ["subjPresent"] });
  });

  it("ignores things answered too few times", () => {
    assert.deepEqual(weakSpots({ ...none, verbs: { ir: tally(0, 4) } }).verbs, []);
  });

  it("ignores things that are going well", () => {
    assert.deepEqual(weakSpots({ ...none, verbs: { ir: tally(19, 1), ser: tally(9, 1) } }).verbs, []);
  });

  it("counts an accent slip as a miss", () => {
    assert.equal(weakSpots({ ...none, verbs: { ir: tally(3, 0, 2) } }).verbs[0].detail, "60% correct of 5");
  });

  it("shows five at most", () => {
    const verbs = Object.fromEntries(["a", "b", "c", "d", "e", "f"].map((v) => [v, tally(1, 9)]));
    assert.equal(weakSpots({ ...none, verbs }).verbs.length, 5);
  });

  it("skips tenses and question types it doesn't know", () => {
    const spots = weakSpots({ ...none, tenses: { old: tally(0, 9) }, kinds: { old: tally(0, 9) } });
    assert.deepEqual(spots.tenses, []);
    assert.deepEqual(spots.mistakes, []);
  });

  it("sends accent slips to the tenses that have the most", () => {
    const spots = weakSpots({
      ...none,
      total: tally(20, 0, 9),
      tenses: { preterite: tally(5, 0, 5), present: tally(5, 0, 1), future: tally(5, 0, 3), imperfect: tally(5, 0, 0), subjPresent: tally(5, 0, 2) },
    });
    assert.equal(spots.mistakes[0].label, "Accent marks");
    assert.equal(spots.mistakes[0].detail, "9 slips");
    assert.deepEqual(spots.mistakes[0].target, { tenses: ["preterite", "future", "subjPresent"] });
  });

  it("leaves accents out when there are only a couple", () => {
    assert.deepEqual(weakSpots({ ...none, total: tally(5, 0, 2), tenses: { present: tally(5, 0, 2) } }).mistakes, []);
  });

  it("includes weak question types", () => {
    const [spot] = weakSpots({ ...none, kinds: { gender: tally(3, 7) } }).mistakes;
    assert.equal(spot.label, "Noun gender");
    assert.deepEqual(spot.target, { kind: "gender" });
  });
});

describe("practice links", () => {
  it("round-trips every kind of target", () => {
    for (const target of [{ tenses: ["preterite", "future"] }, { verb: "oír" }, { kind: "gender" }] as const) {
      assert.deepEqual(parsePractice(practiceHref(target as never).split("?")[1]), target);
    }
  });

  it("ignores anything it doesn't recognize", () => {
    assert.equal(parsePractice(""), null);
    assert.equal(parsePractice("?kind=nope"), null);
    assert.equal(parsePractice("?tenses=nope"), null);
  });

  it("drops unknown tenses and keeps the rest", () => {
    assert.deepEqual(parsePractice("?tenses=nope,present"), { tenses: ["present"] });
  });
});

describe("practicing saved items", () => {
  it("round-trips item IDs with spaces and accents", () => {
    const items = ["verb:hablar:preterite", "vocab:adverb:por si acaso:toEnglish", "vocab:noun:canción:gender"];
    assert.deepEqual(parsePractice(practiceHref({ items }).split("?")[1]), { items });
  });

  it("keeps only scheduled kinds of item, and caps how many", () => {
    assert.deepEqual(parsePractice("?items=listening:dictation|verb:ir:present"), { items: ["verb:ir:present"] });
    assert.equal(parsePractice("?items=writing:toEnglish"), null);
    const many = Array.from({ length: 40 }, (_, i) => `verb:v${i}:present`);
    const parsed = parsePractice(practiceHref({ items: many }).split("?")[1]);
    assert.ok(parsed && "items" in parsed && parsed.items.length === MAX_PRACTICE_ITEMS);
  });
});

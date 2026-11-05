import assert from "node:assert/strict";
import { describe, it } from "node:test";
import levels from "../data/vocab/levels.json";
import { flashcardDeck, newItemOrder, studyCards, vocabDeck } from "./card-decks";
import { ADJECTIVES, ADVERBS, NOUNS, SMALL_WORDS, upToLevel, wordLevel, type LeveledType } from "./vocab";

const LISTS: [LeveledType, { es: string }[]][] = [
  ["noun", NOUNS],
  ["adjective", ADJECTIVES],
  ["adverb", ADVERBS],
  ["small", SMALL_WORDS],
];

// Seeded, so a failure can be repeated.
function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
}

describe("word levels", () => {
  it("gives every word exactly one level, and lists no word that doesn't exist", () => {
    const tagged = levels as Record<LeveledType, Record<string, string[]>>;
    for (const [type, list] of LISTS) {
      const listed = Object.values(tagged[type]).flat();
      assert.equal(new Set(listed).size, listed.length, `${type} has a word at two levels`);
      const words = new Set(list.map((w) => w.es));
      assert.deepEqual(listed.filter((w) => !words.has(w)), [], `${type} levels name missing words`);
      assert.deepEqual(list.filter((w) => !listed.includes(w.es)).map((w) => w.es), [], `${type} words without a level`);
    }
  });

  it("keeps A1 small enough for a beginner", () => {
    const a1 = LISTS.reduce((sum, [type, list]) => sum + list.filter((w) => wordLevel(type, w.es) === "A1").length, 0);
    assert.ok(a1 >= 400 && a1 <= 650, String(a1));
  });

  it("puts everyday words first and rare ones last", () => {
    assert.equal(wordLevel("noun", "madre"), "A1");
    assert.equal(wordLevel("adjective", "bueno"), "A1");
    assert.equal(wordLevel("adverb", "hoy"), "A1");
    assert.equal(wordLevel("small", "de"), "A1");
    assert.equal(wordLevel("noun", "sacacorchos"), "B2");
    assert.equal(wordLevel("small", "cuyo"), "B2");
  });

  it("counts each level as including the ones before", () => {
    assert.ok(upToLevel("B1", "noun", "madre"));
    assert.ok(!upToLevel("A1", "noun", "sacacorchos"));
    assert.ok(upToLevel(null, "noun", "sacacorchos"));
  });
});

describe("decks by level", () => {
  it("vocabulary only asks about words up to the level", () => {
    const next = vocabDeck({ kinds: ["toSpanish", "toEnglish"], wordTypes: ["noun", "adjective", "adverb", "small"], topics: [], level: "A1" }, seeded(7));
    for (let i = 0; i < 200; i++) {
      const item = next()!.track!.item;
      const [, type, es] = item.split(":");
      assert.equal(wordLevel(type as LeveledType, es), "A1", item);
    }
  });

  it("flashcards and learn words keep every phrase but level the rest", () => {
    const cards = studyCards({ side: "toEnglish", types: ["noun", "phrase"], topics: [], level: "A1" });
    const nouns = cards.filter((c) => c.type === "Noun");
    assert.equal(nouns.length, NOUNS.filter((n) => wordLevel("noun", n.es) === "A1").length);
    assert.ok(cards.some((c) => c.type === "Phrase"));
    const deck = flashcardDeck({ side: "toEnglish", types: ["adjective"], topics: [], level: "A1" }, seeded(3));
    for (let card = deck(); card; card = deck()) assert.equal(wordLevel("adjective", card.track!.item.split(":")[2]), "A1");
  });

  it("introduces A1 words before the rest in today's review", () => {
    const words = newItemOrder(new Set()).filter((item) => item.startsWith("vocab:noun:") && item.endsWith(":toEnglish"));
    const firstLevels = words.slice(0, 300).map((item) => wordLevel("noun", item.split(":")[2]));
    assert.ok(firstLevels.every((l) => l === "A1"));
    assert.equal(wordLevel("noun", words.at(-1)!.split(":")[2]), "B2");
  });
});

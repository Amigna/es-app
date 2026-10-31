import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blankCard, blankDeck, vocabDeck } from "./card-decks";
import { englishAnswers, englishCore, gradeCard } from "./drill";
import { SENTENCE_GROUPS } from "./sentence-data";
import { VERBS, findVerb } from "./verbs";

const verb = (inf: string) => {
  const v = findVerb(inf);
  assert.ok(v, inf);
  return v;
};

describe("English answers", () => {
  it("reduces glosses to their core", () => {
    assert.equal(englishCore("To Say."), "say");
    assert.equal(englishCore("the house"), "house");
    assert.deepEqual(englishAnswers("to say, to tell"), ["say", "tell"]);
    assert.deepEqual(englishAnswers("to want; to love"), ["want", "love"]);
    assert.deepEqual(englishAnswers("fish (as food)"), ["fish"]);
  });
});

describe("vocabDeck", () => {
  it("makes answerable cards of every kind", () => {
    const next = vocabDeck(["toSpanish", "toEnglish", "gender", "agreement"]);
    for (let i = 0; i < 500; i++) {
      const card = next();
      assert.ok(card);
      assert.ok(card.answers.length > 0, card.id);
      assert.ok(card.answers.every(Boolean), card.id);
      if (!card.english) assert.equal(gradeCard(card, card.answers[0]), "correct", card.id);
      if (card.choices) assert.ok(card.choices.includes(card.answers[0]), card.id);
    }
  });

  it("accepts a noun with or without its article", () => {
    for (let i = 0; i < 200; i++) {
      const card = vocabDeck(["toSpanish"])();
      assert.ok(card);
      if (card.shown.startsWith("la ")) {
        assert.equal(gradeCard(card, card.shown), "correct");
        assert.equal(gradeCard(card, card.shown.slice(3)), "correct");
        return;
      }
    }
    assert.fail("no feminine noun came up");
  });

  it("returns nothing with no kinds selected", () => {
    assert.equal(vocabDeck([])(), null);
  });
});

describe("blankCard", () => {
  it("blanks out exactly the conjugated form", () => {
    const card = blankCard(SENTENCE_GROUPS, verb("tener"), "present");
    assert.ok(card);
    assert.equal(card.title, "_____ dos hermanas en Santo Domingo.");
    assert.equal(gradeCard(card, "tengo"), "correct");
    assert.equal(card.shown, "tengo");
  });

  it("keeps a pronoun inside the blank for negative commands", () => {
    const card = blankCard(SENTENCE_GROUPS, verb("recordar"), "impNegative");
    assert.ok(card);
    assert.ok(card.title.includes("_____"));
    assert.equal(gradeCard(card, "no me recuerdes"), "correct");
  });

  it("skips tenses marked rare", () => {
    assert.equal(blankCard(SENTENCE_GROUPS, verb("saber"), "impAffirmative"), null);
  });

  it("can blank every sentence in the data", () => {
    let total = 0;
    for (const v of VERBS) {
      for (const tense of ["present", "preterite", "subjPresent", "impNegative"] as const) {
        if (blankCard(SENTENCE_GROUPS, v, tense)) total++;
      }
    }
    assert.ok(total > 800, `only ${total}`);
    const next = blankDeck(SENTENCE_GROUPS, VERBS.slice(0, 10), ["present"]);
    assert.ok(next()?.title.includes("_____"));
  });
});

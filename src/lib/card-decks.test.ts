import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blankCard, blankDeck, newItemOrder, reviewCard, reviewDeck, vocabDeck, type VocabOptions } from "./card-decks";
import { englishAnswers, englishCore, gradeCard, type Card } from "./drill";
import { DEFAULT_SETTINGS, NOUN_TOPICS, parseSettings } from "./drill-settings";
import { SENTENCE_BANK } from "./sentence-data";
import { VERBS, findVerb } from "./verbs";
import { ADJECTIVES, ADVERBS, NOUNS } from "./vocab";

const verb = (inf: string) => {
  const v = findVerb(inf);
  assert.ok(v, inf);
  return v;
};

const options = (patch: Partial<VocabOptions>): VocabOptions => ({
  kinds: ["toSpanish", "toEnglish", "gender", "agreement"],
  wordTypes: ["noun", "adjective", "adverb"],
  topics: [],
  ...patch,
});

/** Draws cards until one matches, failing if it never comes up. */
function draw(next: () => Card | null, match: (c: Card) => boolean): Card {
  for (let i = 0; i < 20000; i++) {
    const card = next();
    assert.ok(card);
    if (match(card)) return card;
  }
  assert.fail("card never came up");
}

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
    const next = vocabDeck(options({}));
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
    const card = draw(vocabDeck(options({ kinds: ["toSpanish"] })), (c) => c.shown.startsWith("la "));
    assert.equal(gradeCard(card, card.shown), "correct");
    assert.equal(gradeCard(card, card.shown.slice(3)), "correct");
  });

  it("accepts regional synonyms in both directions", () => {
    const next = vocabDeck(options({ kinds: ["toSpanish"], wordTypes: ["noun"], topics: ["travel"] }));
    const bus = draw(next, (c) => c.title === "bus");
    assert.equal(gradeCard(bus, "autobús"), "correct");
    assert.equal(gradeCard(bus, "guagua"), "correct");
    const guagua = draw(next, (c) => c.title === "bus (Caribbean)");
    assert.equal(gradeCard(guagua, "guagua"), "correct");
    assert.equal(gradeCard(guagua, "autobús"), "correct");
  });

  it("limits nouns to the chosen topics", () => {
    const foods = new Set(NOUNS.filter((n) => n.topic === "food").map((n) => n.es));
    const next = vocabDeck(options({ kinds: ["gender"], wordTypes: ["noun"], topics: ["food"] }));
    for (let i = 0; i < 200; i++) assert.ok(foods.has(next()!.title));
  });

  it("respects word types", () => {
    const next = vocabDeck(options({ kinds: ["toEnglish"], wordTypes: ["adverb"] }));
    const adverbs = new Set(ADVERBS.map((a) => a.es));
    for (let i = 0; i < 200; i++) assert.ok(adverbs.has(next()!.title));
  });

  it("returns nothing when no question fits", () => {
    assert.equal(vocabDeck(options({ kinds: [] }))(), null);
    assert.equal(vocabDeck(options({ kinds: ["gender"], wordTypes: ["adverb"] }))(), null);
    assert.equal(vocabDeck(options({ kinds: ["agreement"], wordTypes: ["noun"] }))(), null);
  });
});

describe("progress IDs", () => {
  const itemIds = (type: VocabOptions["wordTypes"][number], count: number) =>
    Array.from({ length: count }, (_, n) => {
      const next = vocabDeck({ kinds: ["toEnglish"], wordTypes: [type], topics: [] }, () => (n + 0.5) / count);
      return next()!.track!.item;
    });

  it("gives every word its own ID that Firestore accepts", () => {
    const ids = [...itemIds("noun", NOUNS.length), ...itemIds("adjective", ADJECTIVES.length), ...itemIds("adverb", ADVERBS.length)];
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(ids.filter((id) => id.includes("/")), []);
  });
});

describe("blankCard", () => {
  it("blanks out exactly the conjugated form", () => {
    const card = blankCard(SENTENCE_BANK, verb("tener"), "present", () => 0);
    assert.ok(card);
    assert.equal(card.title, "_____ dos hermanas en Santo Domingo.");
    assert.equal(gradeCard(card, "tengo"), "correct");
    assert.equal(card.shown, "tengo");
  });

  it("uses sentences for every person a verb has them for", () => {
    const seen = new Set<string>();
    for (let n = 0; n < 5; n++) seen.add(blankCard(SENTENCE_BANK, verb("tener"), "present", () => (n + 0.5) / 5)!.ask);
    assert.equal(seen.size, 5);
  });

  it("keeps a pronoun inside the blank for negative commands", () => {
    const card = blankCard(SENTENCE_BANK, verb("recordar"), "impNegative");
    assert.ok(card);
    assert.ok(card.title.includes("_____"));
    assert.equal(gradeCard(card, "no me recuerdes"), "correct");
  });

  it("skips tenses marked rare", () => {
    assert.equal(blankCard(SENTENCE_BANK, verb("saber"), "impAffirmative"), null);
  });

  it("can blank every sentence in the data", () => {
    let total = 0;
    for (const v of VERBS) {
      for (const tense of ["present", "preterite", "subjPresent", "impNegative"] as const) {
        if (blankCard(SENTENCE_BANK, v, tense)) total++;
      }
    }
    assert.ok(total > 800, `only ${total}`);
    const next = blankDeck(SENTENCE_BANK, VERBS.slice(0, 10), ["present"]);
    assert.ok(next()?.title.includes("_____"));
  });
});

describe("today's review", () => {
  const rare = new Set<string>();
  for (const verbs of Object.values(SENTENCE_BANK.groups)) {
    for (const [inf, tenses] of Object.entries(verbs)) {
      for (const [tense, entry] of Object.entries(tenses)) if (entry && "rare" in entry) rare.add(`${inf}:${tense}`);
    }
  }
  const order = newItemOrder(rare);

  it("can rebuild a card for every item it would ever introduce", () => {
    const broken = order.filter((item) => {
      const card = reviewCard(item, SENTENCE_BANK, rare);
      return card?.track?.item !== item;
    });
    assert.deepEqual(broken, []);
    assert.equal(new Set(order).size, order.length);
  });

  it("starts with common verbs in the present, taking turns with words", () => {
    assert.ok(order[0].startsWith("verb:") && order[0].endsWith(":present"));
    assert.ok(order[1].startsWith("vocab:"));
  });

  it("leaves rare tenses out", () => {
    assert.ok(!order.some((item) => rare.has(item.slice("verb:".length))));
  });

  it("uses both kinds of verb question", () => {
    const blank = reviewCard("verb:tener:present", SENTENCE_BANK, rare, () => 0)!;
    const typed = reviewCard("verb:tener:present", SENTENCE_BANK, rare, () => 0.9)!;
    assert.ok(blank.title.includes("_____"));
    assert.equal(typed.title, "tener");
  });

  it("skips items whose word is gone instead of ending the session", () => {
    const next = reviewDeck(["vocab:noun:nope:gender", "verb:nope:present", "quiz:ser:0", "verb:tener:present"], SENTENCE_BANK, rare);
    assert.equal(next()?.track?.item, "verb:tener:present");
    assert.equal(next(), null);
  });
});

describe("drill settings", () => {
  it("lists exactly the noun topics in the data", () => {
    assert.deepEqual([...new Set(NOUNS.map((n) => n.topic))].sort(), NOUN_TOPICS);
  });

  it("falls back to defaults for missing or broken data", () => {
    assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
    assert.deepEqual(parseSettings("not json"), DEFAULT_SETTINGS);
    assert.deepEqual(parseSettings("{}"), DEFAULT_SETTINGS);
  });

  it("keeps valid choices and drops unknown ones", () => {
    const s = parseSettings(
      JSON.stringify({ mode: "vocabulary", pool: "nope", tenses: ["future", "madeUp"], kinds: [], topics: ["food", "zzz"] }),
    );
    assert.equal(s.mode, "vocabulary");
    assert.equal(s.pool, DEFAULT_SETTINGS.pool);
    assert.deepEqual(s.tenses, ["future"]);
    assert.deepEqual(s.kinds, []);
    assert.deepEqual(s.topics, ["food"]);
  });
});

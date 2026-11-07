import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blankCard, blankDeck, listedWordCard, dictationCard, dictationDeck, flashcardDeck, studyCards, newItemOrder, reviewCard, reviewDeck, verbPracticeDeck, vocabDeck, writingCard, writingDeck, type VocabOptions } from "./card-decks";
import { accentTrap, englishAnswers, englishCore, gradeCard, type Card } from "./drill";
import { DEFAULT_SETTINGS, NOUN_TOPICS, parseSettings } from "./drill-settings";
import { schedulable } from "./schedule";
import { SENTENCE_BANK } from "./sentence-data";
import { VERBS, findVerb } from "./verbs";
import { ADJECTIVES, ADVERBS, NOUNS, PHRASES, SMALL_WORDS } from "./vocab";

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

  it("accepts the plain word for an affectionate one, and the other way round", () => {
    const people = vocabDeck(options({ kinds: ["toSpanish"], wordTypes: ["noun"], topics: ["people"] }));
    const grandpa = draw(people, (c) => c.title === "grandpa, grandfather");
    assert.equal(gradeCard(grandpa, "abuelito"), "correct");
    assert.equal(gradeCard(grandpa, "abuelo"), "correct");
    const abuelito = draw(vocabDeck(options({ kinds: ["toEnglish"], wordTypes: ["noun"], topics: ["people"] })), (c) => c.title === "abuelito");
    assert.equal(gradeCard(abuelito, "grandpa"), "correct");
    assert.equal(gradeCard(abuelito, "grandfather"), "correct");
    const family = vocabDeck(options({ kinds: ["toSpanish"], wordTypes: ["noun"], topics: ["family"] }));
    assert.equal(gradeCard(draw(family, (c) => c.title === "mother"), "mamá"), "correct");
    assert.equal(gradeCard(draw(family, (c) => c.title === "mom, mother"), "madre"), "correct");
  });

  it("keeps small words exact, so a gloss can't take a similar word", () => {
    const next = vocabDeck(options({ kinds: ["toSpanish"], wordTypes: ["small"] }));
    const formal = draw(next, (c) => c.title === "you (formal)");
    assert.equal(gradeCard(formal, "usted"), "correct");
    assert.equal(gradeCard(formal, "tú"), "wrong");
    const sino = draw(next, (c) => c.title === "but rather (after a negative)");
    assert.equal(gradeCard(sino, "sino"), "correct");
    assert.equal(gradeCard(sino, "pero"), "wrong");
  });

  it("treats a question word without its accent as a different word", () => {
    const card = draw(vocabDeck(options({ kinds: ["toSpanish"], wordTypes: ["small"] })), (c) => c.shown === "dónde");
    assert.equal(gradeCard(card, "donde"), "wrong");
    assert.equal(accentTrap(card, "donde"), "donde");
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

describe("adjectives in Spanish", () => {
  it("accept the feminine form, and show the masculine", () => {
    const card = listedWordCard("adjective:bonito", "toSpanish")!;
    assert.equal(gradeCard(card, "bonita"), "correct");
    assert.equal(gradeCard(card, "bonito"), "correct");
    assert.equal(gradeCard(card, "bonitos"), "wrong");
    assert.equal(card.shown, "bonito");
    assert.equal(gradeCard(listedWordCard("adjective:trabajador", "toSpanish")!, "trabajadora"), "correct");
  });
});

describe("progress IDs", () => {
  const itemIds = (type: VocabOptions["wordTypes"][number], count: number) =>
    Array.from({ length: count }, (_, n) => {
      const next = vocabDeck({ kinds: ["toEnglish"], wordTypes: [type], topics: [] }, () => (n + 0.5) / count);
      return next()!.track!.item;
    });

  it("gives every word its own ID that Firestore accepts", () => {
    const ids = [
      ...itemIds("noun", NOUNS.length),
      ...itemIds("adjective", ADJECTIVES.length),
      ...itemIds("adverb", ADVERBS.length),
      ...itemIds("small", SMALL_WORDS.length),
    ];
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
    assert.equal(card.sentence, "Tengo dos hermanas en Santo Domingo.");
  });

  it("accepts the other participle in a fill-in-the-blank", () => {
    const card = blankCard(SENTENCE_BANK, verb("imprimir"), "pluperfect", () => 0);
    assert.ok(card);
    assert.equal(card.shown, "había impreso");
    assert.equal(gradeCard(card, "había imprimido"), "correct");
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

describe("verbPracticeDeck", () => {
  const CORE = ["present", "preterite", "imperfect", "future", "conditional", "subjPresent"] as const;
  const drain = (next: () => Card | null) => {
    const cards: Card[] = [];
    for (let card = next(); card; card = next()) cards.push(card);
    return cards;
  };

  it("mixes verb forms and blanks for one verb, with no repeats", () => {
    const cards = drain(verbPracticeDeck(verb("hablar"), SENTENCE_BANK, [...CORE], new Set(), 15));
    assert.equal(cards.length, 15);
    assert.equal(new Set(cards.map((c) => `${c.id}|${c.title}`)).size, 15);
    assert.ok(cards.every((c) => c.track?.item?.startsWith("verb:hablar:")));
    const blanks = cards.filter((c) => c.title.includes("_____")).length;
    assert.ok(blanks > 0 && blanks < 15, `${blanks} blanks`);
  });

  it("gives fewer cards rather than repeating when the verb runs out", () => {
    const cards = drain(verbPracticeDeck(verb("hablar"), {}, ["present"], new Set(), 15));
    assert.equal(cards.length, 5);
  });
});

describe("today's review", () => {
  const rare = new Set<string>();
  for (const [inf, tenses] of Object.entries(SENTENCE_BANK)) {
    for (const [tense, entry] of Object.entries(tenses)) if (entry && "rare" in entry) rare.add(`${inf}:${tense}`);
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

  it("keeps flashcard choices and drops unknown ones", () => {
    const s = parseSettings(JSON.stringify({ mode: "flashcards", flashSide: "sideways", flashTypes: ["phrase", "verb"] }));
    assert.equal(s.mode, "flashcards");
    assert.equal(s.flashSide, DEFAULT_SETTINGS.flashSide);
    assert.deepEqual(s.flashTypes, ["phrase"]);
  });

  it("keeps writing directions and drops unknown ones", () => {
    assert.deepEqual(parseSettings(JSON.stringify({ writingSides: ["toSpanish", "nope"] })).writingSides, ["toSpanish"]);
    assert.deepEqual(parseSettings(JSON.stringify({ writingSides: [] })).writingSides, []);
    assert.equal(parseSettings(JSON.stringify({ mode: "writing" })).mode, "writing");
  });
});

describe("flashcardDeck", () => {
  const all = (next: () => Card | null) => {
    const cards: Card[] = [];
    for (let card = next(); card; card = next()) cards.push(card);
    return cards;
  };

  it("asks each chosen word once, then runs out", () => {
    const cards = all(flashcardDeck({ side: "toEnglish", types: ["phrase"], topics: [] }));
    assert.equal(cards.length, PHRASES.length);
    assert.equal(new Set(cards.map((c) => c.id)).size, PHRASES.length);
  });

  it("shares its item with the typed question", () => {
    const card = flashcardDeck({ side: "toSpanish", types: ["noun"], topics: [] })();
    assert.ok(card?.flashcard);
    assert.match(card.track?.item ?? "", /^vocab:noun:.+:toSpanish$/);
    assert.equal(reviewCard(card.track!.item, SENTENCE_BANK, new Set())?.flashcard, undefined);
  });

  it("hides the Spanish on the front going to Spanish, and shows it going to English", () => {
    const toSpanish = all(flashcardDeck({ side: "toSpanish", types: ["noun"], topics: ["family"] })).find((c) => c.shown === "la madre");
    assert.equal(toSpanish?.title, "mother");
    assert.equal(toSpanish?.flashcard?.example?.es, "Mi madre vive en Santiago.");
    const toEnglish = all(flashcardDeck({ side: "toEnglish", types: ["noun"], topics: ["family"] })).find((c) => c.shown === "mother");
    assert.equal(toEnglish?.title, "la madre");
  });

  it("limits nouns by topic and leaves other word types alone", () => {
    const cards = all(flashcardDeck({ side: "toEnglish", types: ["noun", "adverb"], topics: ["family"] }));
    const family = NOUNS.filter((n) => n.topic === "family").length;
    assert.equal(cards.length, family + ADVERBS.length);
  });

  it("is empty with nothing chosen", () => {
    assert.equal(flashcardDeck({ side: "toEnglish", types: [], topics: [] })(), null);
  });

  it("brings phrases back as flashcards, because they aren't typed", () => {
    for (const side of ["toEnglish", "toSpanish"] as const) {
      for (const card of all(flashcardDeck({ side, types: ["phrase"], topics: [] }))) {
        const rebuilt = reviewCard(card.track!.item, SENTENCE_BANK, new Set());
        assert.ok(rebuilt?.flashcard, card.id);
        assert.equal(rebuilt.id, card.id);
      }
    }
    assert.equal(reviewCard("vocab:phrase:gone:toEnglish", SENTENCE_BANK, new Set()), null);
  });

  it("carries a phrase's note to the answer side", () => {
    const card = all(flashcardDeck({ side: "toEnglish", types: ["phrase"], topics: [] })).find((c) => c.title === "¿Qué bolá?");
    assert.equal(card?.flashcard?.note, "Cuban slang, very informal");
  });
});

describe("writingDeck", () => {
  const verbs = VERBS.slice(0, 10);
  const toSpanish = writingCard(SENTENCE_BANK, verb("tener"), "present", "toSpanish", () => 0)!;
  const toEnglish = writingCard(SENTENCE_BANK, verb("tener"), "present", "toEnglish", () => 0)!;

  it("shows one language and expects the other", () => {
    assert.equal(toSpanish.title, toEnglish.shown);
    assert.equal(toEnglish.title, toSpanish.shown);
    assert.equal(toSpanish.titleIsSpanish, false);
    assert.equal(toEnglish.titleIsSpanish, true);
    assert.ok(toSpanish.writing && toEnglish.writing);
  });

  it("accepts the model answer, with or without punctuation", () => {
    assert.equal(gradeCard(toSpanish, toSpanish.shown), "correct");
    assert.equal(gradeCard(toSpanish, toSpanish.shown.replace(/[.?!¿¡]/g, "").toUpperCase()), "correct");
    assert.equal(gradeCard(toEnglish, toEnglish.shown.replace(/[.?!]/g, "")), "correct");
  });

  it("treats a phone's curly apostrophe as a plain one", () => {
    const card = { ...toEnglish, answers: ["I'm tired."], shown: "I'm tired." };
    assert.equal(gradeCard(card, "I’m tired"), "correct");
  });

  it("flags a missing accent in Spanish, and doesn't care in English", () => {
    const spanish = { ...toSpanish, answers: ["Ella está aquí."] };
    assert.equal(gradeCard(spanish, "Ella está aqui."), "accent");
    // Esta is a word of its own, so that one is a different word.
    assert.equal(gradeCard(spanish, "Ella esta aquí."), "wrong");
    const english = { ...toEnglish, answers: ["We drove to Bogotá."] };
    assert.equal(gradeCard(english, "We drove to Bogota"), "correct");
  });

  it("leaves a different wording to the learner", () => {
    assert.equal(gradeCard(toEnglish, "something else entirely"), "wrong");
  });

  it("stays out of the schedule, and saves one item per direction", () => {
    assert.equal(toSpanish.track?.item, "writing:toSpanish");
    assert.equal(toEnglish.track?.item, "writing:toEnglish");
    assert.equal(schedulable(toSpanish.track!.item), false);
    assert.equal(toSpanish.track?.tense, undefined);
  });

  it("uses both directions when both are chosen, and only one otherwise", () => {
    const seen = new Set<string>();
    const next = writingDeck(SENTENCE_BANK, verbs, ["present"], ["toEnglish", "toSpanish"]);
    for (let i = 0; i < 100; i++) seen.add(next()?.badge ?? "");
    assert.deepEqual([...seen].sort(), ["English to Spanish", "Spanish to English"]);
    assert.equal(writingDeck(SENTENCE_BANK, verbs, ["present"], ["toSpanish"])()?.badge, "English to Spanish");
  });

  it("is empty with nothing to ask", () => {
    assert.equal(writingDeck(SENTENCE_BANK, verbs, ["present"], [])(), null);
    assert.equal(writingDeck(SENTENCE_BANK, verbs, [], ["toEnglish"])(), null);
    assert.equal(writingDeck(SENTENCE_BANK, [], ["present"], ["toEnglish"])(), null);
  });

  it("skips tenses with no sentence", () => {
    assert.equal(writingCard(SENTENCE_BANK, verb("oponer"), "present", "toEnglish"), null);
    assert.ok(writingDeck(SENTENCE_BANK, [verb("oponer")], ["present", "preterite"], ["toEnglish"])());
  });
});

describe("dictation", () => {
  const verbs = VERBS.slice(0, 20);

  it("plays a whole sentence and takes it back typed loosely", () => {
    const next = dictationDeck(SENTENCE_BANK, verbs, ["present", "preterite"]);
    for (let i = 0; i < 100; i++) {
      const card = next();
      assert.ok(card?.dictation, "dictation card");
      assert.equal(gradeCard(card, card.answers[0]), "correct", card.id);
      // Punctuation and capitals don't count.
      assert.equal(gradeCard(card, card.answers[0].replace(/[¿¡.,!?]/g, "").toUpperCase()), "correct", card.id);
      assert.ok(!/\d/.test(card.answers[0]), card.id);
    }
  });

  it("tells an accent slip from a wrong word", () => {
    const card = dictationCard(SENTENCE_BANK, verb("ser"), "present", () => 0.3);
    assert.ok(card);
    assert.equal(card.answers[0], "¿De dónde eres?");
    assert.equal(gradeCard(card, "de dónde éres"), "accent");
    assert.equal(gradeCard(card, "de donde eres"), "wrong");
    assert.equal(gradeCard(card, "de dónde es"), "wrong");
  });

  it("stays out of the schedule", () => {
    const card = dictationDeck(SENTENCE_BANK, verbs, ["present"])();
    assert.equal(card?.track?.item, "listening:dictation");
    assert.equal(schedulable(card!.track!.item), false);
  });
});

describe("studyCards", () => {
  it("shows each chosen word once, with its two sides", () => {
    const cards = studyCards({ side: "toEnglish", types: ["adverb"], topics: [] });
    assert.equal(cards.length, ADVERBS.length);
    assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
    assert.ok(cards.every((c) => c.front.spanish && !c.back.spanish));
  });

  it("puts English first, or mixes", () => {
    assert.ok(studyCards({ side: "toSpanish", types: ["adverb"], topics: [] }).every((c) => !c.front.spanish && c.back.spanish));
    const mixed = studyCards({ side: "mixed", types: ["noun", "adjective"], topics: [] });
    assert.ok(mixed.some((c) => c.front.spanish) && mixed.some((c) => !c.front.spanish));
  });

  it("shows nouns with their article, and keeps to the chosen topics", () => {
    const cards = studyCards({ side: "toEnglish", types: ["noun"], topics: ["food"] });
    assert.equal(cards.length, NOUNS.filter((n) => n.topic === "food").length);
    assert.ok(cards.every((c) => /^(el|la|los|las) /.test(c.front.text)), "articles");
  });

  it("is empty with nothing chosen", () => {
    assert.deepEqual(studyCards({ side: "mixed", types: [], topics: [] }), []);
  });
});

describe("settings for the new modes", () => {
  it("keeps a saved learning side and falls back from a bad one", () => {
    assert.equal(parseSettings(JSON.stringify({ mode: "study", studySide: "toSpanish" })).studySide, "toSpanish");
    assert.equal(parseSettings(JSON.stringify({ mode: "listening" })).mode, "listening");
    assert.equal(parseSettings(JSON.stringify({ studySide: "sideways" })).studySide, DEFAULT_SETTINGS.studySide);
  });
});

describe("accent slips in vocabulary", () => {
  it("counts a different word as wrong and a slip as a slip", () => {
    const papa = draw(vocabDeck(options({ kinds: ["toSpanish"], wordTypes: ["noun"] })), (c) => c.answers.includes("papá"));
    assert.equal(gradeCard(papa, "papa"), "wrong");
    assert.equal(gradeCard(papa, "el papa"), "wrong");
    const cancion = draw(vocabDeck(options({ kinds: ["toSpanish"], wordTypes: ["noun"] })), (c) => c.answers.includes("canción"));
    assert.equal(gradeCard(cancion, "cancion"), "accent");
  });
});

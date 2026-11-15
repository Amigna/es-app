import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  describeItem,
  drillStruggles,
  isStruggling,
  itemStruggles,
  missNudge,
  verbStruggles,
  verbStruggling,
  watchUpdate,
} from "./struggles";

const t = (right: number, wrong: number, accent = 0) => ({ right, accent, wrong });

describe("thresholds", () => {
  it("needs 3 misses and under 60% right for a word or verb tense", () => {
    assert.equal(isStruggling(t(1, 3)), true);
    assert.equal(isStruggling(t(0, 2)), false, "two misses aren't enough");
    assert.equal(isStruggling(t(4, 3)), true, "57% right");
    assert.equal(isStruggling(t(5, 3)), false, "63% right");
    assert.equal(isStruggling(t(20, 4)), false, "4 misses among 20 right isn't a struggle");
  });

  it("leaves accent slips out of misses and of the share right", () => {
    assert.equal(isStruggling(t(1, 2, 10)), false);
    assert.equal(isStruggling(t(1, 3, 10)), true);
  });

  it("needs 10 answers, 5 misses and under 70% right for a whole verb", () => {
    assert.equal(verbStruggling(t(5, 5)), true);
    assert.equal(verbStruggling(t(2, 5, 0)), false, "only 7 answers");
    assert.equal(verbStruggling(t(12, 5)), false, "over 70% right");
    assert.equal(verbStruggling(t(6, 4)), false, "only 4 misses");
  });
});

describe("watchUpdate", () => {
  it("adds an item once it's close to a struggle, with its new all-time totals", () => {
    assert.deepEqual(watchUpdate({ "vocab:noun:casa:gender": t(1, 1) }, { "vocab:noun:casa:gender": t(0, 1) }), {
      "vocab:noun:casa:gender": t(1, 2),
    });
  });

  it("counts a brand-new item from the batch alone", () => {
    assert.deepEqual(watchUpdate({}, { "verb:tener:preterite": t(0, 2) }), { "verb:tener:preterite": t(0, 2) });
  });

  it("takes an item off once it improves, and leaves untouched items alone", () => {
    assert.deepEqual(watchUpdate({ "vocab:noun:casa:gender": t(1, 2) }, { "vocab:noun:casa:gender": t(5, 0) }), {
      "vocab:noun:casa:gender": null,
    });
    assert.deepEqual(watchUpdate({ "vocab:noun:mesa:gender": t(9, 0) }, { "vocab:noun:mesa:gender": t(1, 0) }), {});
  });

  it("skips writing, dictation and quiz items, which share one item across many questions", () => {
    assert.deepEqual(watchUpdate({}, { "writing:toEnglish": t(0, 9), "quiz:ser-estar:3": t(0, 9) }), {});
  });
});

describe("describeItem", () => {
  it("names a verb tense and each word question", () => {
    assert.equal(describeItem("verb:tener:preterite"), "tener in the preterite");
    assert.equal(describeItem("verb:ir:subjPresent"), "ir in the present subjunctive");
    assert.equal(describeItem("vocab:noun:casa:gender"), "the gender of casa");
    assert.equal(describeItem("vocab:adjective:rojo:agreement"), "the endings of rojo");
    assert.equal(describeItem("vocab:noun:casa:toEnglish"), "what casa means");
    assert.equal(describeItem("vocab:phrase:Mucho gusto.:toSpanish"), "Mucho gusto. (English to Spanish)");
  });
});

describe("missNudge", () => {
  it("says how often, with 'this' for a word and the tense for a verb", () => {
    assert.equal(missNudge("vocab:noun:casa:gender", t(1, 4)), "You've missed this 4 times. There's a practice link at the end.");
    assert.equal(missNudge("verb:tener:preterite", t(0, 3)), "You've missed tener in the preterite 3 times. There's a practice link at the end.");
    assert.equal(missNudge("verb:tener:preterite", t(0, 2)), null);
    assert.equal(missNudge("writing:toEnglish", t(0, 9)), null);
  });
});

describe("lists", () => {
  it("sorts items by misses, then the share right", () => {
    const list = itemStruggles({ a: t(0, 3), "vocab:noun:a:gender": t(1, 3), "vocab:noun:b:gender": t(0, 3), "vocab:noun:c:gender": t(0, 5) });
    assert.deepEqual(
      list.map((s) => s.item),
      ["vocab:noun:c:gender", "vocab:noun:b:gender", "vocab:noun:a:gender"],
    );
  });

  it("sorts verbs by the share right", () => {
    assert.deepEqual(
      verbStruggles({ tener: t(6, 5), ir: t(2, 8), ser: t(30, 2) }).map((v) => v.verb),
      ["ir", "tener"],
    );
  });
});

describe("drillStruggles", () => {
  const saved = {
    items: { "verb:tener:preterite": t(1, 2), "vocab:noun:casa:gender": t(0, 6) },
    verbs: { tener: t(4, 4) },
  };

  it("adds this drill's answers to what was saved, and lists only what this drill practiced", () => {
    const result = drillStruggles(saved, { "verb:tener:preterite": t(0, 1), "verb:tener:present": t(0, 1) }, { verbs: 2, items: 5 });
    assert.deepEqual(result.items, [{ item: "verb:tener:preterite", tally: t(1, 3) }], "casa wasn't practiced");
    assert.deepEqual(result.verbs, [{ verb: "tener", tally: t(4, 6) }]);
  });

  it("lists nothing when this drill's answers were fine", () => {
    const result = drillStruggles(saved, { "vocab:noun:mesa:gender": t(3, 0) }, { verbs: 2, items: 5 });
    assert.deepEqual(result, { verbs: [], items: [] });
  });

  it("keeps to the limits", () => {
    const session = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`vocab:noun:w${i}:gender`, t(0, 3)]));
    assert.equal(drillStruggles(saved, session, { verbs: 2, items: 5 }).items.length, 5);
  });
});

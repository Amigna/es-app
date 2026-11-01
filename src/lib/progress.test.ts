import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accuracy, currentStreak, lastSevenDays, localDay, summarize, type Answer } from "./progress";
import { summaryUpdate } from "./progress-store";

const answer = (item: string, grade: Answer["grade"], day = "2026-11-01", tense?: Answer["tense"]): Answer => ({ item, grade, day, tense });

describe("summarize", () => {
  it("adds answers up by item, day, tense and overall", () => {
    const s = summarize([
      answer("verb:tener:preterite", "correct", "2026-11-01", "preterite"),
      answer("verb:tener:preterite", "wrong", "2026-11-01", "preterite"),
      answer("verb:ir:present", "accent", "2026-11-02", "present"),
      answer("vocab:casa:gender", "correct", "2026-11-02"),
    ]);
    assert.deepEqual(s.items["verb:tener:preterite"], { right: 1, accent: 0, wrong: 1, last: "2026-11-01" });
    assert.deepEqual(s.days["2026-11-02"], { right: 1, accent: 1, wrong: 0 });
    assert.deepEqual(s.tenses.preterite, { right: 1, accent: 0, wrong: 1 });
    assert.equal(s.tenses.present.accent, 1);
    assert.deepEqual(s.total, { right: 2, accent: 1, wrong: 1 });
  });

  it("keeps vocabulary out of the tense figures", () => {
    assert.deepEqual(summarize([answer("vocab:casa:gender", "correct")]).tenses, {});
  });

  it("remembers the latest day for an item", () => {
    const s = summarize([answer("a", "correct", "2026-11-03"), answer("a", "correct", "2026-11-01")]);
    assert.equal(s.items.a.last, "2026-11-03");
  });
});

describe("summaryUpdate", () => {
  it("leaves tenses out of a batch without verbs, so stored tense stats survive", () => {
    assert.equal("tenses" in summaryUpdate(summarize([answer("vocab:noun:casa:gender", "correct")])), false);
  });

  it("sends tenses when a batch has verbs", () => {
    const update = summaryUpdate(summarize([answer("verb:ir:present", "correct", "2026-11-01", "present")]));
    assert.ok("tenses" in update);
    assert.deepEqual(Object.keys(update.tenses), ["present"]);
  });
});

describe("accuracy", () => {
  it("counts accent slips as not fully correct", () => {
    assert.equal(accuracy({ right: 3, accent: 1, wrong: 0 }), 75);
  });

  it("has no value before anything is answered", () => {
    assert.equal(accuracy({ right: 0, accent: 0, wrong: 0 }), null);
  });
});

describe("currentStreak", () => {
  it("counts back from today", () => {
    assert.equal(currentStreak(["2026-11-01", "2026-10-31", "2026-10-30"], "2026-11-01"), 3);
  });

  it("still counts when today hasn't been practiced yet", () => {
    assert.equal(currentStreak(["2026-10-31", "2026-10-30"], "2026-11-01"), 2);
  });

  it("ends at a gap", () => {
    assert.equal(currentStreak(["2026-11-01", "2026-10-29"], "2026-11-01"), 1);
    assert.equal(currentStreak(["2026-10-29"], "2026-11-01"), 0);
    assert.equal(currentStreak([], "2026-11-01"), 0);
  });

  it("crosses months and years", () => {
    assert.equal(currentStreak(["2027-01-01", "2026-12-31"], "2027-01-01"), 2);
    assert.equal(currentStreak(["2026-03-01", "2026-02-28"], "2026-03-01"), 2);
  });
});

describe("dates", () => {
  it("pads months and days", () => {
    assert.equal(localDay(new Date(2026, 0, 5)), "2026-01-05");
  });

  it("totals the last seven days only", () => {
    const days = {
      "2026-11-01": { right: 2, accent: 0, wrong: 1 },
      "2026-10-26": { right: 1, accent: 0, wrong: 0 },
      "2026-10-25": { right: 9, accent: 0, wrong: 0 },
    };
    assert.equal(lastSevenDays(days, "2026-11-01"), 4);
  });
});

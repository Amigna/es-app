import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TENSES } from "./conjugation/types";
import { isLevel, LEVELS, levelInfo } from "./level";
import { beyondLevel, levelChangesByWeek, levelReadiness, levelSync, type LevelChange } from "./level-up";
import type { Tally } from "./progress";

describe("levels", () => {
  it("each level keeps the tenses of the one before", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      for (const tense of LEVELS[i - 1].tenses) assert.ok(LEVELS[i].tenses.includes(tense), `${LEVELS[i].id} is missing ${tense}`);
      assert.ok(LEVELS[i].commonVerbs >= LEVELS[i - 1].commonVerbs);
    }
  });

  it("only names real tenses", () => {
    const ids = new Set(TENSES.map((t) => t.id));
    for (const level of LEVELS) for (const tense of level.tenses) assert.ok(ids.has(tense), tense);
  });

  it("starts beginners on the present only", () => {
    assert.deepEqual(levelInfo("A1").tenses, ["present"]);
  });

  it("rejects anything that isn't a level", () => {
    assert.ok(isLevel("B1"));
    assert.equal(isLevel("C2"), false);
    assert.equal(isLevel(null), false);
  });
});

const t = (right: number, wrong = 0, accent = 0): Tally => ({ right, accent, wrong });

describe("level readiness", () => {
  it("suggests the next level at 85% over enough answers", () => {
    const r = levelReadiness({ "2026-11-01": { tenses: { present: t(260, 40) } } }, "A1")!;
    assert.equal(r.next, "A2");
    assert.equal(r.answered, 300);
    assert.equal(r.accuracy, 87);
    assert.ok(r.ready);
  });

  it("waits for enough answers and a high enough share", () => {
    assert.equal(levelReadiness({ "2026-11-01": { tenses: { present: t(200) } } }, "A1")!.ready, false);
    assert.equal(levelReadiness({ "2026-11-01": { tenses: { present: t(240, 60) } } }, "A1")!.ready, false);
  });

  it("only counts the latest few hundred answers, so old mistakes stop counting", () => {
    const days = {
      "2026-10-01": { tenses: { present: t(0, 300) } },
      "2026-11-01": { tenses: { present: t(150) } },
      "2026-11-02": { tenses: { present: t(150) } },
    };
    const r = levelReadiness(days, "A1")!;
    assert.equal(r.answered, 300);
    assert.equal(r.accuracy, 100);
    assert.ok(r.ready);
  });

  it("needs some answers in every one of the level's tenses, and ignores other tenses", () => {
    const r = levelReadiness({ "2026-11-01": { tenses: { present: t(280), preterite: t(15), imperfect: t(20), future: t(0, 500) } } }, "A2")!;
    assert.deepEqual(r.thin, ["preterite"]);
    assert.equal(r.accuracy, 100);
    assert.equal(r.ready, false);
  });

  it("leaves accent slips out of the share but counts them as answers", () => {
    const r = levelReadiness({ "2026-11-01": { tenses: { present: t(170, 30, 100) } } }, "A1")!;
    assert.equal(r.answered, 300);
    assert.equal(r.accuracy, 85);
    assert.ok(r.ready);
  });

  it("handles days saved before tenses were, and the top level", () => {
    assert.equal(levelReadiness({ "2026-11-01": {} }, "A1")!.answered, 0);
    assert.equal(levelReadiness({}, "B2"), null);
  });
});

describe("answers beyond the level", () => {
  it("counts recent answers that don't count toward the next level", () => {
    const b = beyondLevel({ "2026-11-08": { tenses: { present: t(5), preterite: t(20, 2), imperfect: t(10, 3) } } }, "A1");
    assert.equal(b.answered, 40);
    assert.equal(b.outside, 35);
    assert.equal(b.ahead, null);
  });

  it("names the highest level whose added tenses are going well", () => {
    const b = beyondLevel({ "2026-11-08": { tenses: { present: t(10), preterite: t(30, 10), future: t(40, 2), subjPresent: t(20, 3) } } }, "A1");
    // A2's tenses are at 75%, B1's at 92% over 65 answers, and the future is the most answered of them.
    assert.deepEqual(b.ahead, { level: "B1", accuracy: 92, answered: 65, tense: "future" });
  });

  it("needs enough answers and a high enough share", () => {
    assert.equal(beyondLevel({ "2026-11-08": { tenses: { preterite: t(40) } } }, "A1").ahead, null);
    assert.equal(beyondLevel({ "2026-11-08": { tenses: { preterite: t(40, 20) } } }, "A1").ahead, null);
    assert.equal(beyondLevel({ "2026-11-08": { tenses: { preterite: t(60) } } }, "A1").ahead?.level, "A2");
  });

  it("only looks at the latest few hundred answers", () => {
    const b = beyondLevel({ "2026-10-01": { tenses: { preterite: t(100) } }, "2026-11-08": { tenses: { present: t(300) } } }, "A1");
    assert.equal(b.outside, 0);
    assert.equal(b.ahead, null);
  });
});

describe("level sync on sign-in", () => {
  it("takes the account's level when it's newer or this browser has none", () => {
    assert.equal(levelSync({ level: "A1", at: 100 }, { level: "A2", at: 200 }), "take");
    assert.equal(levelSync({ level: null, at: 0 }, { level: "A2", at: 0 }), "take");
    // Same level, newer time: only the time is taken.
    assert.equal(levelSync({ level: "A2", at: 100 }, { level: "A2", at: 200 }), "take");
  });

  it("sends this browser's level when it's newer or the account has none", () => {
    assert.equal(levelSync({ level: "B1", at: 300 }, { level: "A2", at: 200 }), "send");
    assert.equal(levelSync({ level: "B1", at: 0 }, null), "send");
    // Dated beats undated, which is how levels were saved before.
    assert.equal(levelSync({ level: "B1", at: 300 }, { level: "A2", at: 0 }), "send");
  });

  it("does nothing on a tie or when they agree", () => {
    assert.equal(levelSync({ level: "A1", at: 0 }, { level: "A2", at: 0 }), "none");
    assert.equal(levelSync({ level: "A2", at: 300 }, { level: "A2", at: 200 }), "none");
    assert.equal(levelSync({ level: null, at: 0 }, null), "none");
  });
});

describe("level changes by week", () => {
  it("places changes in the weeks the trend shows, the latest in a week winning", () => {
    const history: LevelChange[] = [
      { level: "A1", day: "2026-06-01" },
      { level: "A2", day: "2026-10-01" },
      { level: "B1", day: "2026-11-02" },
      { level: "A2", day: "2026-11-05" },
    ];
    assert.deepEqual(levelChangesByWeek(history, "2026-11-08", 12), [
      { ago: 5, level: "A2" },
      { ago: 0, level: "A2" },
    ]);
  });
});

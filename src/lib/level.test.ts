import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TENSES } from "./conjugation/types";
import { isLevel, LEVELS, levelInfo } from "./level";

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

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import picks from "../data/essential-verbs.json";
import { COMMON_COUNT, ESSENTIAL_VERBS, OTHER_VERBS } from "./essential-verbs";
import { VERBS } from "./verbs";

describe("essential verbs", () => {
  it("lists only verbs that exist, once each", () => {
    const known = new Set(VERBS.map((v) => v.inf));
    for (const inf of picks) assert.ok(known.has(inf), `${inf} isn't in verbs.json`);
    assert.equal(new Set(picks).size, picks.length, "a verb is listed twice");
  });

  it("adds only verbs that aren't already among the most common", () => {
    const common = new Set(VERBS.slice(0, COMMON_COUNT).map((v) => v.inf));
    for (const inf of picks) assert.ok(!common.has(inf), `${inf} is already in the first ${COMMON_COUNT}`);
  });

  it("splits every verb into one block", () => {
    assert.equal(ESSENTIAL_VERBS.length, COMMON_COUNT + picks.length);
    assert.equal(ESSENTIAL_VERBS.length + OTHER_VERBS.length, VERBS.length);
    assert.equal(new Set([...ESSENTIAL_VERBS, ...OTHER_VERBS]).size, VERBS.length);
  });
});

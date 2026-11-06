import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BADGES, earnedBadges, findBadge, nextBadges, withSaved } from "./badges";
import { CHAPTERS, type CourseProgress } from "./course";

const TODAY = "2026-11-05";
const done = (day: string) => ({ steps: [], best: 90, done: day });

describe("badges", () => {
  it("have unique IDs, one for each chapter, and a level badge for each level in the course", () => {
    assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length);
    for (const c of CHAPTERS) assert.ok(findBadge(`chapter:${c.id}`), c.id);
    for (const level of new Set(CHAPTERS.map((c) => c.level))) assert.ok(findBadge(`level:${level}`), level);
  });

  it("gives a chapter its badge on the day it was passed", () => {
    const earned = earnedBadges({ course: { [CHAPTERS[0].id]: done("2026-11-01") } }, TODAY);
    assert.equal(earned[`chapter:${CHAPTERS[0].id}`], "2026-11-01");
    assert.equal(earned[`level:${CHAPTERS[0].level}`], undefined);
  });

  it("gives a level its badge once every chapter at it is done, on the last day", () => {
    const a1 = CHAPTERS.filter((c) => c.level === "A1");
    const course: CourseProgress = Object.fromEntries(a1.map((c, i) => [c.id, done(`2026-10-${String(10 + i).padStart(2, "0")}`)]));
    const earned = earnedBadges({ course }, TODAY);
    assert.equal(earned["level:A1"], `2026-10-${String(10 + a1.length - 1).padStart(2, "0")}`);
    assert.equal(earned["level:A2"], undefined);
    assert.equal(earned.course, undefined);
    const everything = Object.fromEntries(CHAPTERS.map((c) => [c.id, done("2026-11-02")]));
    assert.equal(earnedBadges({ course: everything }, TODAY).course, "2026-11-02");
  });

  it("counts days in a row, on the day the run reached the length", () => {
    const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-20"];
    const earned = earnedBadges({ course: {}, days }, TODAY);
    assert.equal(earned["days:7"], "2026-10-07");
    assert.equal(earned["days:30"], undefined);
    assert.equal(earnedBadges({ course: {}, days: days.slice(0, 6) }, TODAY)["days:7"], undefined);
    // Across a month end.
    const across = ["2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"];
    assert.equal(earnedBadges({ course: {}, days: across }, TODAY)["days:7"], "2026-10-03");
  });

  it("gives drill streak and mastered badges up to the number reached", () => {
    const earned = earnedBadges({ course: {}, drillStreak: { streak: 30, day: "2026-10-09" }, mastered: 120 }, TODAY);
    assert.equal(earned["drill:25"], "2026-10-09");
    assert.equal(earned["drill:50"], undefined);
    assert.equal(earned["mastered:100"], TODAY);
    assert.equal(earned["mastered:250"], undefined);
  });

  it("counts a comeback only from under the pass mark to 90% or more", () => {
    const tries = (...scores: number[]) => ({ steps: [], tries: scores.map((score, i) => ({ day: `2026-10-0${i + 1}`, score })) });
    assert.equal(earnedBadges({ course: { x: tries(60, 85, 95) } }, TODAY).comeback, "2026-10-03");
    assert.equal(earnedBadges({ course: { x: tries(85, 95) } }, TODAY).comeback, undefined);
    assert.equal(earnedBadges({ course: { x: tries(70, 85) } }, TODAY).comeback, undefined);
  });

  it("keeps the first day a badge was seen, even after a streak ends", () => {
    assert.deepEqual(withSaved({ "days:7": "2026-11-05" }, { "days:7": "2026-10-07", "drill:25": "2026-09-01" }), {
      "days:7": "2026-10-07",
      "drill:25": "2026-09-01",
    });
  });

  it("suggests the next of each kind, none already earned", () => {
    const next = nextBadges({ [`chapter:${CHAPTERS[0].id}`]: TODAY, "days:7": TODAY });
    assert.equal(next[0].id, `chapter:${CHAPTERS[1].id}`);
    assert.ok(next.some((b) => b.id === "days:30"));
    assert.ok(next.every((b) => b.id !== "days:7"));
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { firstMemory, intervalDays, nextMemory, retrievability, type Rating } from "./fsrs";

/** Plays a card through reviews given as [rating, days since the previous review]. */
function play(first: Rating, reviews: [Rating, number][]) {
  let memory = firstMemory(first);
  const intervals: number[] = [];
  for (const [rating, elapsed] of reviews) {
    memory = nextMemory(memory, rating, elapsed);
    intervals.push(intervalDays(memory.stability));
  }
  return { memory, intervals };
}

// Expected values come from py-fsrs's own test suite, so these don't just compare our math with itself.
describe("FSRS against py-fsrs", () => {
  it("matches test_memo_state", () => {
    const { memory } = play(1, [
      [3, 0],
      [3, 1],
      [3, 3],
      [3, 8],
      [3, 21],
    ]);
    assert.ok(Math.abs(memory.stability - 53.62691) < 1e-4, `stability ${memory.stability}`);
    assert.ok(Math.abs(memory.difficulty - 6.3574867) < 1e-4, `difficulty ${memory.difficulty}`);
  });

  it("matches the interval history in test_review_card", () => {
    const { intervals } = play(3, [
      [3, 0],
      [3, 2],
      [3, 11],
      [3, 46],
      [3, 163],
    ]);
    assert.deepEqual(intervals, [2, 11, 46, 163, 498]);
  });
});

describe("FSRS behavior", () => {
  it("has 90% recall when a whole stability has passed", () => {
    assert.ok(Math.abs(retrievability(10, 10) - 0.9) < 1e-9);
  });

  it("starts stability in rating order", () => {
    const [again, hard, good] = ([1, 2, 3] as const).map((r) => firstMemory(r).stability);
    assert.ok(again < hard && hard < good);
  });

  it("makes a word harder after a miss and grows stability after a recall", () => {
    const start = firstMemory(3);
    const missed = nextMemory(start, 1, 2);
    const recalled = nextMemory(start, 3, 2);
    assert.ok(missed.stability < start.stability);
    assert.ok(missed.difficulty > start.difficulty);
    assert.ok(recalled.stability > start.stability);
  });

  it("schedules at least tomorrow", () => {
    assert.equal(intervalDays(0.2), 1);
  });
});

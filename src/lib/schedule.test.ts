import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Answer } from "./progress";
import { addDays, daysBetween, pickToday, planReviews, reviewItem, schedulable, type TodayData } from "./schedule";

const answer = (item: string, grade: Answer["grade"], day: string): Answer => ({ item, grade, day });

describe("dates", () => {
  it("adds days across months, years and clock changes", () => {
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2027-03-13", 2), "2027-03-15");
    assert.equal(daysBetween("2026-12-31", "2027-01-02"), 2);
    assert.equal(daysBetween("2027-03-13", "2027-03-15"), 2);
  });
});

describe("reviewItem", () => {
  it("brings a missed new item back tomorrow", () => {
    assert.equal(reviewItem(undefined, "wrong", "2026-11-01").due, "2026-11-02");
  });

  it("waits longer after a correct answer than an accent slip", () => {
    const good = reviewItem(undefined, "correct", "2026-11-01");
    const accent = reviewItem(undefined, "accent", "2026-11-01");
    assert.equal(good.due, "2026-11-03");
    assert.ok(accent.due < good.due);
  });

  it("spreads reviews out as an item keeps being remembered", () => {
    const first = reviewItem(undefined, "correct", "2026-11-01");
    const second = reviewItem(first, "correct", first.due);
    const third = reviewItem(second, "correct", second.due);
    assert.ok(daysBetween(second.last, second.due) > daysBetween(first.last, first.due));
    assert.ok(daysBetween(third.last, third.due) > daysBetween(second.last, second.due));
  });

  it("brings a forgotten item back soon", () => {
    const known = reviewItem(reviewItem(undefined, "correct", "2026-11-01"), "correct", "2026-11-03");
    assert.equal(reviewItem(known, "wrong", known.due).due, addDays(known.due, 2));
  });
});

describe("planReviews", () => {
  it("leaves quiz questions out", () => {
    assert.equal(schedulable("quiz:ser-estar:0"), false);
    assert.deepEqual(planReviews([answer("quiz:ser-estar:0", "correct", "2026-11-01")], {}).schedules, {});
  });

  it("counts only the first answer each day", () => {
    const plan = planReviews(
      [answer("verb:ir:present", "wrong", "2026-11-01"), answer("verb:ir:present", "correct", "2026-11-01")],
      {},
    );
    assert.equal(plan.schedules["verb:ir:present"].due, "2026-11-02");
    assert.deepEqual(plan.fresh, ["verb:ir:present"]);
    const { newItems, reviews } = plan.perDay["2026-11-01"];
    assert.deepEqual({ newItems, reviews }, { newItems: 1, reviews: 0 });
  });

  it("doesn't move a schedule when a batch is sent twice", () => {
    const answers = [answer("verb:ir:present", "correct", "2026-11-03")];
    const first = planReviews(answers, { "verb:ir:present": reviewItem(undefined, "correct", "2026-11-01") });
    const again = planReviews(answers, first.schedules);
    assert.deepEqual(again.schedules, {});
    assert.deepEqual(again.perDay, {});
  });

  it("separates new items from reviews", () => {
    const stored = { "verb:ir:present": reviewItem(undefined, "correct", "2026-11-01") };
    const plan = planReviews([answer("verb:ir:present", "correct", "2026-11-03"), answer("verb:ser:present", "correct", "2026-11-03")], stored);
    const { newItems, reviews } = plan.perDay["2026-11-03"];
    assert.deepEqual({ newItems, reviews }, { newItems: 1, reviews: 1 });
    assert.deepEqual(plan.fresh, ["verb:ser:present"]);
  });

  it("counts recall only for items that had come due, by how they went", () => {
    const learned = reviewItem(undefined, "correct", "2026-11-01");
    const stored = {
      "verb:ir:present": learned,
      "verb:ser:present": learned,
      "verb:ver:present": learned,
      "verb:dar:present": learned,
    };
    const due = learned.due;
    const plan = planReviews(
      [
        answer("verb:ir:present", "correct", due),
        answer("verb:ser:present", "accent", due),
        answer("verb:ver:present", "wrong", addDays(due, 2)),
        // A second answer the same day doesn't count again.
        answer("verb:ir:present", "wrong", due),
      ],
      stored,
    );
    assert.deepEqual(plan.perDay[due].recall, { right: 1, accent: 1, wrong: 0 });
    assert.deepEqual(plan.perDay[addDays(due, 2)].recall, { right: 0, accent: 0, wrong: 1 });
    // Practiced before its due day: a review, but not a test of memory.
    const before = addDays(due, -1);
    assert.ok(before > learned.last, "the item needs a day between its last review and its due day");
    const practiced = planReviews([answer("verb:dar:present", "correct", before)], stored).perDay[before];
    assert.equal(practiced.reviews, 1);
    assert.deepEqual(practiced.recall, { right: 0, accent: 0, wrong: 0 });
    // A new item isn't a recall either.
    assert.deepEqual(planReviews([answer("verb:tener:present", "correct", due)], stored).perDay[due].recall, { right: 0, accent: 0, wrong: 0 });
  });

  it("handles days in a backlog in order", () => {
    const plan = planReviews([answer("verb:ir:present", "correct", "2026-11-01"), answer("verb:ir:present", "correct", "2026-11-03")], {});
    assert.equal(plan.schedules["verb:ir:present"].last, "2026-11-03");
    assert.deepEqual(plan.fresh, ["verb:ir:present"]);
  });
});

describe("pickToday", () => {
  const data: TodayData = { due: ["a", "b"], seen: ["a", "b", "c"], newDone: 0, reviewsDone: 0, reviewsPerDay: 50, newPerDay: 2, wanted: [] };
  const order = ["a", "c", "d", "e", "f"];

  it("puts wanted items first among new ones, within the daily limit", () => {
    assert.deepEqual(pickToday({ ...data, wanted: ["f"] }, order).fresh, ["f", "d"]);
    assert.deepEqual(pickToday({ ...data, wanted: ["f", "e", "d"], newDone: 1 }, order).fresh, ["f"]);
  });

  it("skips wanted items already started or not in the order", () => {
    assert.deepEqual(pickToday({ ...data, wanted: ["c", "gone"] }, order).fresh, ["d", "e"]);
  });

  it("takes what's due plus new items that haven't started", () => {
    assert.deepEqual(pickToday(data, order), { reviews: ["a", "b"], fresh: ["d", "e"], paused: false });
  });

  it("counts new items already done today", () => {
    assert.deepEqual(pickToday({ ...data, newDone: 1 }, order).fresh, ["d"]);
    assert.deepEqual(pickToday({ ...data, newDone: 5 }, order).fresh, []);
  });

  it("stops at the daily review limit", () => {
    assert.deepEqual(pickToday({ ...data, reviewsDone: 49 }, order).reviews, ["a"]);
    assert.deepEqual(pickToday({ ...data, reviewsDone: 50 }, order).reviews, []);
    assert.deepEqual(pickToday({ ...data, reviewsPerDay: 1 }, order).reviews, ["a"]);
  });

  describe("pausing new items while the pile is bigger than a day's limit", () => {
    const pile = (n: number) => Array.from({ length: n }, (_, i) => `due${i}`);

    it("pauses them, wanted ones included, when more is due than the limit", () => {
      const today = pickToday({ ...data, due: pile(51), wanted: ["f"] }, order);
      assert.equal(today.paused, true);
      assert.deepEqual(today.fresh, []);
      assert.equal(today.reviews.length, 50);
    });

    it("keeps them when exactly a day's worth is due", () => {
      const today = pickToday({ ...data, due: pile(50) }, order);
      assert.equal(today.paused, false);
      assert.deepEqual(today.fresh, ["d", "e"]);
    });

    it("counts reviews already done today against the limit", () => {
      assert.equal(pickToday({ ...data, due: pile(21), reviewsDone: 30 }, order).paused, true);
      assert.equal(pickToday({ ...data, due: pile(20), reviewsDone: 30 }, order).paused, false);
      // The limit is used up and some are still due: tomorrow starts behind, so nothing new today either.
      assert.equal(pickToday({ ...data, due: pile(1), reviewsDone: 50 }, order).paused, true);
    });

    it("lets a pile of 343 shrink by the limit each day, and resumes new items once it fits", () => {
      // The real account: 343 due, 50 a day. Leaving out reviewed items that come due again, it fits on day 7.
      let due = 343;
      const days: boolean[] = [];
      while (due > 0) {
        const today = pickToday({ ...data, due: pile(Math.min(due, 101)) }, order);
        days.push(today.paused);
        due -= today.reviews.length;
      }
      assert.deepEqual(days, [true, true, true, true, true, true, false]);
    });
  });
});

describe("flashcards on the schedule", () => {
  it("schedules a phrase like a word, so knowing it pushes it further out than missing it", () => {
    const item = "vocab:phrase:Mucho gusto.:toEnglish";
    const knew = planReviews([{ item, grade: "correct", day: "2026-11-01" }], {});
    const missed = planReviews([{ item, grade: "wrong", day: "2026-11-01" }], {});
    assert.deepEqual(knew.fresh, [item]);
    assert.ok(knew.schedules[item].due > missed.schedules[item].due);
  });
});

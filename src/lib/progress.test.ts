import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inviteAllowsVulgar, statusOfInvite } from "./firebase";
import { accuracy, calendarWeeks, currentStreak, lastSevenDays, localDay, recentWeeks, summarize, wordsPracticed, type Answer, type Tally } from "./progress";
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

  it("adds answers up by verb and question type", () => {
    const s = summarize([
      answer("verb:ser:present", "correct", "2026-11-01", "present"),
      answer("verb:ser:future", "wrong", "2026-11-01", "future"),
      answer("vocab:noun:casa:gender", "wrong"),
      answer("quiz:ser-estar:0", "correct"),
    ]);
    assert.deepEqual(s.verbs, { ser: { right: 1, accent: 0, wrong: 1 } });
    assert.deepEqual(s.kinds, { gender: { right: 0, accent: 0, wrong: 1 } });
  });

  it("keeps vocabulary out of the tense figures", () => {
    assert.deepEqual(summarize([answer("vocab:casa:gender", "correct")]).tenses, {});
  });

  it("remembers the latest day for an item", () => {
    const s = summarize([answer("a", "correct", "2026-11-03"), answer("a", "correct", "2026-11-01")]);
    assert.equal(s.items.a.last, "2026-11-03");
  });
});

describe("statusOfInvite", () => {
  it("treats hand-made invites with no added field as approved", () => {
    assert.equal(statusOfInvite({}), "invited");
    assert.equal(statusOfInvite({ added: true }), "invited");
  });

  it("keeps requests waiting until added is true", () => {
    assert.equal(statusOfInvite({ added: false }), "requested");
  });

  it("knows when there's no invite at all", () => {
    assert.equal(statusOfInvite(undefined), "none");
  });
});

describe("inviteAllowsVulgar", () => {
  it("needs an approved invite with vulgar set to true", () => {
    assert.equal(inviteAllowsVulgar({ vulgar: true }), true);
    assert.equal(inviteAllowsVulgar({ added: true, vulgar: true }), true);
  });

  it("is off otherwise", () => {
    assert.equal(inviteAllowsVulgar(undefined), false);
    assert.equal(inviteAllowsVulgar({}), false);
    assert.equal(inviteAllowsVulgar({ vulgar: false }), false);
    assert.equal(inviteAllowsVulgar({ added: false, vulgar: true }), false);
  });
});

describe("summaryUpdate", () => {
  it("leaves empty maps out, so stored stats survive", () => {
    const vocab = summaryUpdate(summarize([answer("vocab:noun:casa:gender", "correct")]));
    assert.equal("tenses" in vocab, false);
    assert.equal("verbs" in vocab, false);
    assert.deepEqual(Object.keys(vocab.kinds ?? {}), ["gender"]);
    const verb = summaryUpdate(summarize([answer("verb:ir:present", "correct", "2026-11-01", "present")]));
    assert.equal("kinds" in verb, false);
    assert.equal("writing" in verb, false);
  });

  it("sends writing when a batch has translations", () => {
    const update = summaryUpdate(summarize([answer("writing:toSpanish", "correct")]));
    assert.deepEqual(Object.keys(update.writing ?? {}), ["toSpanish"]);
  });

  it("sends tenses and verbs when a batch has verbs", () => {
    const update = summaryUpdate(summarize([answer("verb:ir:present", "correct", "2026-11-01", "present")]));
    assert.deepEqual(Object.keys(update.tenses ?? {}), ["present"]);
    assert.deepEqual(Object.keys(update.verbs ?? {}), ["ir"]);
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

describe("wordsPracticed", () => {
  it("counts each word once by type, whatever was asked about it", () => {
    assert.deepEqual(
      wordsPracticed([
        "vocab:noun:casa:gender",
        "vocab:noun:casa:toSpanish",
        "vocab:noun:perro:toEnglish",
        "vocab:adverb:mañana:toEnglish",
        "vocab:phrase:Mucho gusto.:toEnglish",
      ]),
      { noun: 2, adverb: 1, phrase: 1 },
    );
  });

  it("keeps a word separate from the same spelling in another list", () => {
    assert.deepEqual(wordsPracticed(["vocab:noun:mañana:toEnglish", "vocab:adverb:mañana:toEnglish"]), { noun: 1, adverb: 1 });
  });

  it("ignores verbs and guide questions", () => {
    assert.deepEqual(wordsPracticed(["verb:ser:present", "quiz:ser-estar:0"]), {});
  });

  it("adds phrases to the question type figures like any other word", () => {
    assert.equal(summarize([answer("vocab:phrase:Mucho gusto.:toEnglish", "wrong")]).kinds.toEnglish.wrong, 1);
  });
});

describe("writing answers", () => {
  it("adds up by direction and by day", () => {
    const s = summarize([
      answer("writing:toSpanish", "correct", "2026-11-01"),
      answer("writing:toSpanish", "wrong", "2026-11-01"),
      answer("writing:toEnglish", "correct", "2026-11-02"),
    ]);
    assert.deepEqual(s.writing.toSpanish, { right: 1, accent: 0, wrong: 1 });
    assert.deepEqual(s.writingDays["2026-11-01"], { toSpanish: { right: 1, accent: 0, wrong: 1 } });
    assert.deepEqual(s.writingDays["2026-11-02"], { toEnglish: { right: 1, accent: 0, wrong: 0 } });
  });

  it("still counts toward the totals, and stays out of tenses and vocabulary", () => {
    const s = summarize([answer("writing:toEnglish", "correct")]);
    assert.equal(s.total.right, 1);
    assert.equal(s.days["2026-11-01"].right, 1);
    assert.deepEqual(s.tenses, {});
    assert.deepEqual(s.verbs, {});
    assert.deepEqual(s.kinds, {});
  });

  it("leaves other answers out", () => {
    assert.deepEqual(summarize([answer("verb:ser:present", "correct")]).writingDays, {});
  });
});

describe("recentWeeks", () => {
  const right = (n: number): Tally => ({ right: n, accent: 0, wrong: 0 });

  it("groups seven days at a time, going back from today", () => {
    const days = { "2026-11-14": right(1), "2026-11-08": right(2), "2026-11-07": right(4), "2026-11-01": right(8), "2026-10-31": right(16) };
    const weeks = recentWeeks(days, "2026-11-14", (d) => d, 3);
    assert.deepEqual(weeks.map((w) => w.right), [3, 12, 16]);
  });

  it("keeps empty weeks in place", () => {
    const weeks = recentWeeks({ "2026-10-30": right(5) }, "2026-11-14", (d) => d, 3);
    assert.deepEqual(weeks.map((w) => w.right), [0, 0, 5]);
  });

  it("reads just the part asked for", () => {
    const days = { "2026-11-14": { ...right(9), writing: { toSpanish: { right: 1, accent: 0, wrong: 1 } } }, "2026-11-13": right(9) };
    const [week] = recentWeeks(days, "2026-11-14", (d: Tally & { writing?: Record<string, Tally> }) => d.writing?.toSpanish, 1);
    assert.deepEqual(week, { right: 1, accent: 0, wrong: 1 });
  });

  it("crosses a month and a year", () => {
    const weeks = recentWeeks({ "2025-12-31": right(1), "2026-01-01": right(2) }, "2026-01-03", (d) => d, 1);
    assert.equal(weeks[0].right, 3);
  });
});

describe("calendarWeeks", () => {
  const right = (n: number): Tally => ({ right: n, accent: 0, wrong: 0 });

  it("runs Monday to Sunday with today in the last week", () => {
    // 2026-11-04 is a Wednesday.
    const weeks = calendarWeeks({ "2026-11-02": right(4), "2026-10-26": right(1) }, "2026-11-04", 2);
    assert.equal(weeks.length, 2);
    assert.deepEqual(weeks.map((w) => [w[0].day, w[6].day]), [["2026-10-26", "2026-11-01"], ["2026-11-02", "2026-11-08"]]);
    assert.equal(weeks[0][0].answered, 1);
    assert.equal(weeks[1][0].answered, 4);
    assert.deepEqual(weeks[1].map((d) => d.future), [false, false, false, true, true, true, true]);
  });

  it("puts a Sunday at the end of the last week", () => {
    const weeks = calendarWeeks({}, "2026-11-08", 1);
    assert.equal(weeks[0][6].day, "2026-11-08");
    assert.ok(weeks[0].every((d) => !d.future));
  });
});

describe("listening and mistakes", () => {
  it("adds dictation up by kind and day, apart from writing", () => {
    const s = summarize([answer("listening:dictation", "correct", "2026-11-02"), answer("listening:dictation", "wrong", "2026-11-02")]);
    assert.deepEqual(s.listening, { dictation: { right: 1, accent: 0, wrong: 1 } });
    assert.deepEqual(s.listeningDays["2026-11-02"], { dictation: { right: 1, accent: 0, wrong: 1 } });
    assert.deepEqual(s.writing, {});
  });

  it("keeps what was typed on a miss, by day, as plain strings", () => {
    const mistake = { label: "Preterite", prompt: "hablar · Preterite · yo", given: "hablé", answer: "hablé" };
    const s = summarize([
      { ...answer("verb:hablar:preterite", "wrong", "2026-11-02", "preterite"), mistake: { ...mistake, given: "hablo" } },
      { ...answer("verb:ir:present", "correct", "2026-11-02", "present"), mistake },
      answer("vocab:noun:casa:toEnglish", "wrong", "2026-11-02"),
    ]);
    assert.deepEqual(s.mistakes, {
      "2026-11-02": [{ item: "verb:hablar:preterite", label: "Preterite", prompt: "hablar · Preterite · yo", given: "hablo", answer: "hablé", grade: "wrong" }],
    });
  });

  it("cuts long text", () => {
    const long = "a".repeat(1000);
    const s = summarize([{ ...answer("writing:toEnglish", "wrong"), mistake: { label: "", prompt: long, given: long, answer: long } }]);
    assert.equal(s.mistakes["2026-11-01"][0].prompt.length, 300);
  });

  it("saves dictation totals next to the others", () => {
    const update = summaryUpdate(summarize([answer("listening:dictation", "correct")])) as Record<string, unknown>;
    assert.ok(update.listening);
    assert.equal(update.writing, undefined);
  });
});

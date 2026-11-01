import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conjugate } from "./conjugation/engine";
import { TENSES } from "./conjugation/types";
import { conjugationCard, grade, isIrregular, makeQuestion, poolVerbs } from "./drill";
import { SENTENCE_GROUPS } from "./sentence-data";
import { findForm, findSentence } from "./sentences";
import { VERBS, findVerb } from "./verbs";

const verb = (inf: string) => {
  const v = findVerb(inf);
  assert.ok(v, inf);
  return v;
};

describe("grade", () => {
  it("accepts exact answers, ignoring case and extra spaces", () => {
    assert.equal(grade("tuve", "tuve"), "correct");
    assert.equal(grade("  He   Hablado ", "he hablado"), "correct");
  });

  it("separates accent mistakes from wrong answers", () => {
    assert.equal(grade("hablo", "habló"), "accent");
    assert.equal(grade("averigue", "averigüe"), "accent");
    assert.equal(grade("tube", "tuve"), "wrong");
  });

  it("treats ñ as a different letter", () => {
    assert.equal(grade("sueno", "sueño"), "wrong");
  });
});

describe("conjugationCard", () => {
  const q = { verb: verb("llamar"), tense: "imperfect", person: 3, label: "nosotros", answer: "llamábamos" } as const;
  const sentence = { person: 1, es: "¿Por qué me llamabas tanto ayer?", en: "Why were you calling me so much yesterday?" };

  it("shows the example with its verb blanked and names its person", () => {
    assert.deepEqual(conjugationCard(q, sentence).example, {
      label: "Example with tú",
      es: "¿Por qué me _____ tanto ayer?",
      en: sentence.en,
    });
  });

  it("blanks a verb used twice", () => {
    const twice = { person: 1, es: "Llamabas y llamabas.", en: "You kept calling." };
    assert.equal(conjugationCard(q, twice).example?.es, "_____ y _____.");
  });

  it("never gives away the answer, for any verb, tense or person", () => {
    const leaks: string[] = [];
    for (const v of VERBS) {
      for (const { id: tense } of TENSES) {
        const sentence = findSentence(SENTENCE_GROUPS, v.inf, tense);
        if (!sentence) continue;
        conjugate(v).tenses[tense]?.forms.forEach((answer, person) => {
          if (!answer) return;
          const es = conjugationCard({ verb: v, tense, person, label: "", answer }, sentence).example?.es ?? "";
          if (findForm(es, answer)) leaks.push(`${v.inf} ${tense} ${person}: ${es}`);
        });
      }
    }
    assert.deepEqual(leaks, []);
  });

  it("leaves the example off when there's no sentence", () => {
    assert.equal(conjugationCard(q, null).example, undefined);
  });
});

describe("poolVerbs", () => {
  it("keeps the common set small and includes poder", () => {
    const common = poolVerbs(VERBS, "common");
    assert.equal(common.length, 50);
    assert.ok(common.some((v) => v.inf === "poder"));
  });

  it("finds irregular and stem-changing verbs", () => {
    assert.ok(isIrregular(verb("tener")));
    assert.ok(isIrregular(verb("dormir")));
    assert.ok(isIrregular(verb("detener")));
    assert.equal(isIrregular(verb("hablar")), false);
  });
});

describe("makeQuestion", () => {
  const none = new Set<string>();

  it("always gives a real answer for the chosen person", () => {
    for (let i = 0; i < 300; i++) {
      const q = makeQuestion(VERBS, ["present", "subjPresent", "impAffirmative"], none);
      assert.ok(q);
      assert.ok(q.answer.length > 0);
      assert.ok(q.label.length > 0);
      if (q.tense === "impAffirmative") assert.notEqual(q.person, 0);
    }
  });

  it("keeps impersonal verbs to their natural persons", () => {
    for (let i = 0; i < 50; i++) {
      assert.equal(makeQuestion([verb("llover")], ["present"], none)?.answer, "llueve");
      assert.notEqual(makeQuestion([verb("gustar")], ["present"], none)?.person, 0);
    }
  });

  it("skips tenses marked rare and verbs with no forms", () => {
    const rare = new Set(["saber:impAffirmative"]);
    assert.equal(makeQuestion([verb("saber")], ["impAffirmative"], rare), null);
    assert.equal(makeQuestion([verb("haber")], ["impNegative"], none), null);
  });

  it("does not confuse the imperfect with the imperative", () => {
    const q = makeQuestion([verb("hablar")], ["imperfect"], none, () => 0);
    assert.equal(q?.label, "yo");
    assert.equal(q?.answer, "hablaba");
  });
});

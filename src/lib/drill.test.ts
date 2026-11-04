import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conjugate } from "./conjugation/engine";
import { TENSES } from "./conjugation/types";
import { accentTrap, conjugationCard, grade, gradeCard, isIrregular, limitedDeck, makeQuestion, poolVerbs, wordDiff } from "./drill";
import { SENTENCE_BANK } from "./sentence-data";
import { findForm, sentencesFor } from "./sentences";
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
  const q = { verb: verb("llamar"), tense: "imperfect", person: 1, label: "tú", answer: "llamabas" } as const;
  const sentence = { person: 1, es: "¿Por qué me llamabas tanto ayer?", en: "Why were you calling me so much yesterday?" };

  it("shows the example with the answer blanked when it's for the person asked", () => {
    assert.deepEqual(conjugationCard(q, [sentence]).example, { es: "¿Por qué me _____ tanto ayer?", en: sentence.en });
  });

  it("leaves the example off when it's for a different person", () => {
    const nosotros = { ...q, person: 3, label: "nosotros", answer: "llamábamos" };
    assert.equal(conjugationCard(nosotros, [sentence]).example, undefined);
  });

  it("picks the sentence for the person asked", () => {
    const other = { person: 0, es: "Yo te llamaba.", en: "I used to call you." };
    assert.equal(conjugationCard(q, [other, sentence]).example?.en, sentence.en);
  });

  it("blanks a verb used twice", () => {
    const twice = { person: 1, es: "Llamabas y llamabas.", en: "You kept calling." };
    assert.equal(conjugationCard(q, [twice]).example?.es, "_____ y _____.");
  });

  it("never gives away the answer, for any verb, tense or person", () => {
    const leaks: string[] = [];
    for (const v of VERBS) {
      for (const { id: tense } of TENSES) {
        const sentences = sentencesFor(SENTENCE_BANK, v.inf, tense);
        conjugate(v).tenses[tense]?.forms.forEach((answer, person) => {
          if (!answer) return;
          const es = conjugationCard({ verb: v, tense, person, label: "", answer }, sentences).example?.es ?? "";
          if (findForm(es, answer)) leaks.push(`${v.inf} ${tense} ${person}: ${es}`);
        });
      }
    }
    assert.deepEqual(leaks, []);
  });

  it("leaves the example off when there's no sentence", () => {
    assert.equal(conjugationCard(q).example, undefined);
  });

  it("shows the tense in full after a miss, marking the person asked", () => {
    const table = conjugationCard(q).table;
    assert.equal(table?.tense, "imperfect");
    assert.equal(table?.person, 1);
  });

  it("gives the table the main sentence, unless the card already shows it", () => {
    const main = { person: 0, es: "Yo te llamaba.", en: "I used to call you." };
    assert.equal(conjugationCard(q, [main, sentence]).table?.sentence, main);
    assert.equal(conjugationCard(q, [sentence, main]).table?.sentence, undefined);
  });
});

describe("limitedDeck", () => {
  it("stops after the given number of cards", () => {
    const card = conjugationCard({ verb: verb("ser"), tense: "present", person: 0, label: "yo", answer: "soy" });
    const next = limitedDeck(() => card, 2);
    assert.equal(next(), card);
    assert.equal(next(), card);
    assert.equal(next(), null);
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

describe("wordDiff", () => {
  const marks = (input: string, answer: string) => wordDiff(input, answer).map((w) => `${w.word}:${w.mark}`);

  it("marks every word caught, ignoring punctuation and capitals", () => {
    assert.deepEqual(marks("de donde eres", "¿De dónde eres?"), ["¿De:ok", "dónde:accent", "eres?:ok"]);
    assert.deepEqual(marks("De dónde eres", "¿De dónde eres?"), ["¿De:ok", "dónde:ok", "eres?:ok"]);
  });

  it("finds missed words wherever they are", () => {
    assert.deepEqual(marks("mi hermana enfermera", "Mi hermana es enfermera."), ["Mi:ok", "hermana:ok", "es:missed", "enfermera.:ok"]);
    assert.deepEqual(marks("", "Hola amigo."), ["Hola:missed", "amigo.:missed"]);
  });

  it("doesn't let extra or wrong words shift the rest", () => {
    assert.deepEqual(marks("la la fiesta fue muy increíble", "La fiesta fue increíble."), ["La:ok", "fiesta:ok", "fue:ok", "increíble.:ok"]);
    assert.deepEqual(marks("la fiesta era increíble", "La fiesta fue increíble."), ["La:ok", "fiesta:ok", "fue:missed", "increíble.:ok"]);
  });
});

describe("accent slips that make another word", () => {
  const card = (inf: string, tense: Parameters<typeof conjugationCard>[0]["tense"], person: number) => {
    const verb = findVerb(inf)!;
    const answer = conjugate(verb).tenses[tense]!.forms[person]!;
    return conjugationCard({ verb, tense, person, label: "", answer });
  };

  it("lets an extra accent stay a slip", () => {
    assert.equal(gradeCard(card("ser", "subjImperfect", 2), "fuéra"), "accent");
  });

  it("lets a plain slip stay a slip", () => {
    const c = card("continuar", "impNegative", 1);
    assert.equal(c.answers[0], "no continúes");
    assert.equal(gradeCard(c, "No continues"), "accent");
    assert.equal(accentTrap(c, "no continues"), null);
  });

  it("marks another form of the same verb wrong", () => {
    const c = card("hablar", "preterite", 2);
    assert.equal(gradeCard(c, "hablo"), "wrong");
    assert.equal(accentTrap(c, "hablo"), "hablo");
    assert.equal(gradeCard(c, "habló"), "correct");
  });

  it("marks a different common word wrong", () => {
    const c = card("estar", "present", 2);
    assert.equal(gradeCard(c, "esta"), "wrong");
    assert.equal(accentTrap(c, "esta"), "esta");
  });

  it("finds the trap word inside a sentence", () => {
    const c = { ...card("estar", "present", 2), answers: ["Mi mamá está en casa."], shown: "Mi mamá está en casa.", dictation: { en: "" } };
    assert.equal(gradeCard(c, "mi mama está en casa"), "accent");
    assert.equal(gradeCard(c, "mi mamá esta en casa"), "wrong");
  });

  it("leaves English answers alone", () => {
    const c = { ...card("hablar", "present", 0), english: true, answers: ["speak"] };
    assert.equal(accentTrap(c, "speak"), null);
  });
});

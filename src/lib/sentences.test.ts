import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conjugate } from "./conjugation/engine";
import type { TenseId } from "./conjugation/types";
import { SENTENCE_BANK, SENTENCE_GROUPS, getSentences } from "./sentence-data";
import { checkSentences, findForm, sentenceGroup, sentencesFor, type Sentence } from "./sentences";
import { VERBS, findVerb } from "./verbs";

describe("findForm", () => {
  it("matches whole words, ignoring case", () => {
    assert.deepEqual(findForm("Sé cocinar.", "sé"), { start: 0, end: 2 });
    assert.equal(findForm("Hablamos mucho.", "habla"), null);
    assert.equal(findForm("Ya he comido.", "he comido")?.start, 3);
  });

  it("allows object pronouns inside a negative command", () => {
    assert.ok(findForm("No me digas eso.", "no digas"));
    assert.equal(findForm("No quiero que digas eso.", "no digas"), null);
  });
});

describe("sentence data", () => {
  it("files each verb under its ending", () => {
    assert.equal(sentenceGroup("hablar"), "ar");
    assert.equal(sentenceGroup("levantarse"), "ar");
    assert.equal(sentenceGroup("oír"), "ir");
    assert.ok(getSentences("creer"));
    assert.equal(getSentences("nope"), null);
  });

  it("is complete and matches the engine", (t) => {
    const problems: string[] = [];
    let total = 0;
    for (const [group, verbs] of Object.entries(SENTENCE_GROUPS)) {
      for (const [inf, data] of Object.entries(verbs)) {
        total++;
        const verb = findVerb(inf);
        if (verb?.inf !== inf) {
          problems.push(`${group}.json: "${inf}" is not a listed verb`);
          continue;
        }
        if (sentenceGroup(inf) !== group) problems.push(`${inf} belongs in ${sentenceGroup(inf)}.json`);
        for (const p of checkSentences(conjugate(verb), data)) problems.push(`${inf} ${p}`);
      }
    }
    t.diagnostic(`${total} of ${VERBS.length} verbs have sentences`);
    assert.deepEqual(problems, []);
  });

  it("has valid sentences per person", (t) => {
    const problems: string[] = [];
    let total = 0;
    for (const [inf, tenses] of Object.entries(SENTENCE_BANK.persons)) {
      const verb = findVerb(inf);
      if (verb?.inf !== inf) {
        problems.push(`"${inf}" is not a listed verb`);
        continue;
      }
      for (const [tense, rows] of Object.entries(tenses) as [TenseId, Sentence[]][]) {
        const seen = sentencesFor({ ...SENTENCE_BANK, persons: {} }, inf, tense).map((s) => s.person);
        if (seen.length === 0) problems.push(`${inf} ${tense}: no main sentence`);
        const forms = conjugate(verb).tenses[tense]?.forms ?? [];
        for (const s of rows) {
          total++;
          const label = `${inf} ${tense} ${s.person}`;
          if (seen.includes(s.person)) problems.push(`${label}: person already has a sentence`);
          seen.push(s.person);
          const form = forms[s.person];
          if (!form || !findForm(s.es, form)) problems.push(`${label}: "${s.es}" does not contain "${form}"`);
          if (!/[.?!]$/.test(s.es) || !/[.?!"]$/.test(s.en)) problems.push(`${label}: needs end punctuation`);
          if (/\bvosotr[oa]s\b/i.test(s.es)) problems.push(`${label}: uses vosotros`);
        }
      }
    }
    t.diagnostic(`${total} sentences per person`);
    assert.deepEqual(problems, []);
  });
});

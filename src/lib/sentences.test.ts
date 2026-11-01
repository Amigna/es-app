import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conjugate } from "./conjugation/engine";
import type { TenseId } from "./conjugation/types";
import { SENTENCE_BANK, SENTENCE_FILES, getSentences } from "./sentence-data";
import { VERBS_PER_FILE, filesFor, itemVerbs, loadSentences } from "./sentence-loader";
import { checkSentences, findForm, sentencesFor, type Sentence } from "./sentences";
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
  it("looks up a verb's main sentences", () => {
    assert.equal((getSentences("creer")?.present as Sentence).person, sentencesFor(SENTENCE_BANK, "creer", "present")[0].person);
    assert.equal(getSentences("nope"), null);
  });

  it("files each verb by its place in verbs.json", () => {
    const problems: string[] = [];
    SENTENCE_FILES.forEach((file, index) => {
      for (const inf of Object.keys(file)) {
        const verb = findVerb(inf);
        if (verb?.inf !== inf) problems.push(`"${inf}" is not a listed verb`);
        else if (filesFor([verb])[0] !== index) problems.push(`${inf} is in file ${index + 1}, not ${filesFor([verb])[0] + 1}`);
      }
    });
    assert.deepEqual(problems, []);
  });

  it("has a file for every verb", () => {
    assert.ok(VERBS.length <= SENTENCE_FILES.length * VERBS_PER_FILE, "add a new sentence file");
  });

  it("is complete and matches the engine", (t) => {
    const problems: string[] = [];
    let total = 0;
    for (const inf of Object.keys(SENTENCE_BANK)) {
      total++;
      const verb = findVerb(inf)!;
      for (const p of checkSentences(conjugate(verb), getSentences(inf)!)) problems.push(`${inf} ${p}`);
    }
    t.diagnostic(`${total} of ${VERBS.length} verbs have sentences`);
    assert.deepEqual(problems, []);
  });

  it("has valid sentences per person", (t) => {
    const problems: string[] = [];
    let total = 0;
    for (const [inf, tenses] of Object.entries(SENTENCE_BANK)) {
      const verb = findVerb(inf)!;
      for (const tense of Object.keys(tenses) as TenseId[]) {
        const [main, ...rows] = sentencesFor(SENTENCE_BANK, inf, tense);
        if (!main) continue;
        const seen = [main.person];
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

describe("sentence loader", () => {
  it("needs one file for the common verbs, and all of them for every verb", () => {
    assert.deepEqual(filesFor(VERBS.slice(0, 50)), [0]);
    assert.deepEqual(filesFor([VERBS[0], VERBS[50]]), [0, 1]);
    assert.deepEqual(filesFor(VERBS), SENTENCE_FILES.map((_, i) => i));
    assert.deepEqual(filesFor([]), []);
  });

  it("loads the same data the server has, and only the files asked for", async () => {
    assert.deepEqual(await loadSentences(VERBS), SENTENCE_BANK);
    const common = await loadSentences(VERBS.slice(0, 50));
    assert.ok(common.ser);
    assert.equal(common[VERBS[50].inf], undefined);
  });

  it("finds the verbs in saved items", () => {
    const verbs = itemVerbs(["verb:hablar:present", "verb:hablar:future", "vocab:noun:casa:gender", "verb:nope:present", "verb:oír:present"]);
    assert.deepEqual(verbs.map((v) => v.inf), ["hablar", "oír"]);
  });
});

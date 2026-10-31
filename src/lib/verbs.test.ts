import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VERBS, findVerb, searchVerbs, verbSlug, VERB_SHAPE } from "./verbs";
import { conjugate } from "./conjugation/engine";
import { TENSES } from "./conjugation/types";

describe("verb seed", () => {
  it("has unique, well-formed infinitives", () => {
    const seen = new Set<string>();
    for (const v of VERBS) {
      assert.match(v.inf, VERB_SHAPE, v.inf);
      assert.ok(!seen.has(v.inf), `duplicate ${v.inf}`);
      seen.add(v.inf);
      assert.ok(v.en.startsWith("to "), `${v.inf} gloss`);
      if (v.like) assert.ok(v.inf.replace(/se$/, "").endsWith(v.like), `${v.inf} like ${v.like}`);
    }
  });

  it("conjugates every verb into clean forms in every tense", () => {
    for (const v of VERBS) {
      const c = conjugate(v);
      for (const t of TENSES) {
        const tense = c.tenses[t.id];
        assert.ok(tense, `${v.inf} missing ${t.id}`);
        const all = [...tense.forms, tense.vos];
        for (const f of all) {
          if (f == null) continue;
          assert.match(f, /^[a-zñáéíóúü]+( [a-zñáéíóúü]+){0,2}$/, `${v.inf} ${t.id}: "${f}"`);
        }
      }
      assert.match(c.gerund, /^[a-zñáéíóúü]+$/, `${v.inf} gerund`);
      assert.match(c.participle, /^[a-zñáéíóúü]+$/, `${v.inf} participle`);
    }
  });

  it("has unique URL slugs", () => {
    const slugs = new Set(VERBS.map((v) => verbSlug(v.inf)));
    assert.equal(slugs.size, VERBS.length);
  });

  it("looks verbs up ignoring accents and case", () => {
    assert.equal(findVerb("OIR")?.inf, "oír");
    assert.equal(findVerb(" Reir ")?.inf, "reír");
    assert.equal(findVerb("nope"), undefined);
    assert.equal(searchVerbs("hab")[0].inf, "haber");
    assert.ok(searchVerbs("to eat").some((v) => v.inf === "comer"));
  });
});

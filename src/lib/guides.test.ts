import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHAPTERS } from "./course";
import { GUIDES, REGIONAL, findGuide } from "./guides";
import { LEVEL_ORDER, atOrBelow } from "./level-order";
import { VULGAR } from "./vulgar-data";

describe("guides", () => {
  it("have unique URL-safe slugs", () => {
    const slugs = GUIDES.map((g) => g.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    for (const s of slugs) assert.match(s, /^[a-z-]+$/);
  });

  it("have an example for every rule", () => {
    for (const g of GUIDES) {
      assert.ok(g.title && g.summary, g.slug);
      assert.ok(g.sections.length > 0, g.slug);
      for (const s of g.sections) {
        assert.ok(s.rules.length > 0, s.heading);
        for (const r of s.rules) {
          assert.ok(r.examples.length > 0, r.rule);
          for (const e of r.examples) assert.ok(e.es && e.en, r.rule);
        }
      }
    }
  });

  it("have the level of the first chapter that uses them", () => {
    for (const g of GUIDES) {
      assert.ok(LEVEL_ORDER.includes(g.level), g.slug);
      const levels = CHAPTERS.filter((c) => c.guide?.slug === g.slug).map((c) => LEVEL_ORDER.indexOf(c.level));
      if (levels.length > 0) assert.equal(g.level, LEVEL_ORDER[Math.min(...levels)], g.slug);
    }
  });

  it("filter by level", () => {
    assert.ok(atOrBelow("A1", "A2"));
    assert.ok(atOrBelow("A2", "A2"));
    assert.ok(!atOrBelow("B1", "A2"));
    assert.ok(atOrBelow("B2", null));
  });

  it("look up by slug", () => {
    assert.equal(findGuide("por-vs-para")?.title, "Por vs. para");
    assert.equal(findGuide("nope"), undefined);
  });
});

describe("regional words", () => {
  it("have at least one word and a place for each", () => {
    const seen = new Set<string>();
    for (const r of REGIONAL) {
      assert.ok(!seen.has(r.en), `duplicate ${r.en}`);
      seen.add(r.en);
      assert.ok(r.topic, r.en);
      assert.ok(r.words.length > 0, r.en);
      for (const w of r.words) assert.ok(w.es && w.where, r.en);
    }
  });

  it("explain every vulgar word", () => {
    const seen = new Set<string>();
    for (const r of VULGAR) {
      assert.ok(!seen.has(r.en), `duplicate ${r.en}`);
      seen.add(r.en);
      assert.equal(r.topic, "vulgar", r.en);
      assert.ok(r.note, r.en);
      assert.ok(r.words.length > 0, r.en);
      for (const w of r.words) assert.ok(w.es && w.where, r.en);
    }
  });
});

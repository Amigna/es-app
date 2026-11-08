import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findForm } from "./sentences";
import {
  ADJECTIVES,
  ADVERBS,
  NOUNS,
  PHRASES,
  SMALL_WORDS,
  adjectiveForms,
  isPluralOnly,
  nounArticle,
  nounPlural,
  pluralOf,
  type Noun,
} from "./vocab";

const noun = (es: string) => {
  const n = NOUNS.find((x) => x.es === es);
  assert.ok(n, es);
  return n as Noun;
};

function unique(words: string[], label: string) {
  const seen = new Set<string>();
  for (const w of words) {
    assert.ok(!seen.has(w), `${label} duplicate: ${w}`);
    seen.add(w);
  }
}

describe("plurals and articles", () => {
  it("handles regular plurals and keeps the stress", () => {
    assert.equal(pluralOf("casa"), "casas");
    assert.equal(pluralOf("café"), "cafés");
    assert.equal(pluralOf("ciudad"), "ciudades");
    assert.equal(pluralOf("luz"), "luces");
    assert.equal(pluralOf("lápiz"), "lápices");
    assert.equal(pluralOf("camión"), "camiones");
    assert.equal(pluralOf("autobús"), "autobuses");
    assert.equal(pluralOf("joven"), "jóvenes");
    assert.equal(pluralOf("examen"), "exámenes");
    assert.equal(pluralOf("país"), "países");
    assert.equal(pluralOf("rey"), "reyes");
    assert.equal(pluralOf("mes"), "meses");
    assert.equal(pluralOf("gris"), "grises");
  });

  it("leaves an unstressed final -s alone", () => {
    assert.equal(pluralOf("lunes"), "lunes");
    assert.equal(pluralOf("gratis"), "gratis");
    assert.equal(pluralOf("cumpleaños"), "cumpleaños");
  });

  it("marks words used only in the plural", () => {
    assert.equal(nounArticle(noun("lentes")), "los");
    assert.ok(isPluralOnly(noun("tenis")));
    assert.equal(isPluralOnly(noun("casa")), false);
  });

  it("uses overrides for exceptions", () => {
    assert.equal(nounPlural(noun("lunes")), "lunes");
    assert.equal(nounArticle(noun("agua")), "el");
    assert.equal(nounArticle(noun("mano")), "la");
    assert.equal(nounArticle(noun("día")), "el");
  });

  it("builds the four adjective forms", () => {
    const form = (es: string) => {
      const a = ADJECTIVES.find((x) => x.es === es);
      assert.ok(a, es);
      return adjectiveForms(a);
    };
    assert.deepEqual(form("alto"), ["alto", "alta", "altos", "altas"]);
    assert.deepEqual(form("grande"), ["grande", "grande", "grandes", "grandes"]);
    assert.deepEqual(form("feliz"), ["feliz", "feliz", "felices", "felices"]);
    assert.deepEqual(form("trabajador"), ["trabajador", "trabajadora", "trabajadores", "trabajadoras"]);
  });
});

describe("vocabulary data", () => {
  it("has no duplicates", () => {
    unique(NOUNS.map((n) => n.es), "noun");
    unique(ADJECTIVES.map((a) => a.es), "adjective");
    unique(ADVERBS.map((a) => a.es), "adverb");
    unique(SMALL_WORDS.map((w) => w.es), "small word");
    unique(PHRASES.map((p) => p.es), "phrase");
  });

  it("uses each word in its own example", (t) => {
    t.diagnostic(`${NOUNS.length} nouns, ${ADJECTIVES.length} adjectives, ${ADVERBS.length} adverbs, ${SMALL_WORDS.length} small words, ${PHRASES.length} phrases`);
    const problems: string[] = [];
    for (const n of NOUNS) {
      if (!findForm(n.ex.es, n.es) && !findForm(n.ex.es, nounPlural(n))) problems.push(`noun ${n.es}: "${n.ex.es}"`);
    }
    for (const a of ADJECTIVES) {
      if (!adjectiveForms(a).some((f) => findForm(a.ex.es, f))) problems.push(`adjective ${a.es}: "${a.ex.es}"`);
    }
    for (const a of ADVERBS) {
      if (!findForm(a.ex.es, a.es)) problems.push(`adverb ${a.es}: "${a.ex.es}"`);
    }
    for (const w of SMALL_WORDS) {
      if (!findForm(w.ex.es, w.es)) problems.push(`small word ${w.es}: "${w.ex.es}"`);
    }
    assert.deepEqual(problems, []);
  });

  it("has complete entries", () => {
    const sentence = /[.?!]$/;
    for (const w of [...NOUNS, ...ADJECTIVES, ...ADVERBS, ...SMALL_WORDS]) {
      assert.ok(w.en, w.es);
      assert.match(w.ex.es, sentence, w.es);
      assert.match(w.ex.en, sentence, w.es);
    }
    for (const n of NOUNS) assert.ok(n.gender === "m" || n.gender === "f", n.es);
    for (const p of PHRASES) assert.ok(p.en && p.topic, p.es);
    const topics = ["prepositions", "conjunctions", "pronouns", "question words", "articles", "numbers"];
    for (const w of SMALL_WORDS) assert.ok(topics.includes(w.topic), w.es);
  });

  it("keeps commas out of small word glosses' brackets, where they would split the answers", () => {
    for (const w of SMALL_WORDS) assert.doesNotMatch(w.en, /\([^)]*,/, w.es);
  });
});

describe("saved item IDs", () => {
  it("can be built from every word and phrase", () => {
    // Firestore IDs can't contain a slash, and items are split on colons.
    for (const { es } of [...NOUNS, ...ADJECTIVES, ...ADVERBS, ...SMALL_WORDS, ...PHRASES]) {
      assert.ok(!/[/:]/.test(es), es);
      assert.ok(Buffer.byteLength(`vocab:phrase:${es}:toEnglish`) < 1500, es);
    }
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { newItemOrder } from "./card-decks";
import { READINGS } from "./reading-data";
import { tokenize } from "./readings";
import { lookupWord } from "./word-lookup";

const find = (token: string, headword: string) => {
  const match = lookupWord(token).find((m) => m.headword === headword);
  assert.ok(match, `${token} -> ${headword}`);
  return match;
};

describe("lookupWord", () => {
  it("finds nouns and their plurals", () => {
    const casa = find("casas", "la casa");
    assert.equal(casa.detail, "Noun, plural");
    assert.equal(casa.item, "vocab:noun:casa:toEnglish");
    assert.equal(find("Casa", "la casa").detail, "Noun");
  });

  it("finds every entry a spelling could be", () => {
    assert.ok(lookupWord("como").some((m) => m.detail === "Small word"));
    const comer = find("como", "comer");
    assert.match(comer.detail, /Present · yo/);
    assert.equal(comer.item, "verb:comer:present");
    assert.equal(comer.href, "/verb/comer");
  });

  it("lists every person sharing a form", () => {
    assert.match(find("comía", "comer").detail, /Imperfect · yo, él \/ ella \/ usted/);
    assert.equal(find("comió", "comer").item, "verb:comer:preterite");
  });

  it("finds reflexive forms without their pronoun", () => {
    assert.equal(find("levanto", "levantarse").item, "verb:levantarse:present");
    assert.ok(lookupWord("levanto").some((m) => m.headword === "levantar"));
  });

  it("finds infinitives, gerunds and forms with pronouns attached", () => {
    assert.equal(find("hablando", "hablar").detail, "Gerund (-ing form)");
    assert.equal(find("hablar", "hablar").item, "verb:hablar:present");
    assert.match(find("dime", "decir").detail, /Command, with a pronoun attached/);
    assert.match(find("decirlo", "decir").detail, /Infinitive/);
  });

  it("finds both participles of a verb that has two", () => {
    assert.equal(find("impreso", "imprimir").detail, "Past participle");
    assert.equal(find("imprimido", "imprimir").detail, "Past participle");
  });

  it("finds nothing for names", () => {
    assert.deepEqual(lookupWord("Xochimilco"), []);
  });

  it("only offers items Today's review can show", () => {
    const order = new Set(newItemOrder(new Set()));
    const words = READINGS.flatMap((r) => r.paragraphs.flatMap((p) => tokenize(p.es).filter((t) => t.word).map((t) => t.text)));
    let found = 0;
    for (const word of words) {
      for (const match of lookupWord(word)) {
        found++;
        // Verbs are checked against the order with no rare tenses, which is the widest it gets.
        assert.ok(order.has(match.item), `${word}: ${match.item}`);
      }
    }
    assert.ok(found > words.length / 2, `${found} matches for ${words.length} words`);
  });
});

describe("tokenize", () => {
  it("keeps every character, splitting out the words", () => {
    const text = "¿Dónde está el baño? —preguntó Ana.";
    const tokens = tokenize(text);
    assert.equal(tokens.map((t) => t.text).join(""), text);
    assert.deepEqual(tokens.filter((t) => t.word).map((t) => t.text), ["Dónde", "está", "el", "baño", "preguntó", "Ana"]);
  });
});
